// Import from MyAnimeList XML exports and Watcharr JSON exports. Items are resolved against
// TMDB one at a time so the client can show progress and let the user pick between matches.
import { XMLParser } from 'fast-xml-parser';
import { api } from '../lib/tmdb.js';
import { err } from '../lib/http.js';
import { ensureMedia } from './media.js';
import { getTracking, track, markUpTo, setEpisodeWatched, startRewatch } from './progress.js';
import { now } from '../db.js';

const MAL_STATUS = { Watching: 'watching', Completed: 'watched', 'Plan to Watch': 'to_watch', 'On-Hold': 'on_hold', Dropped: 'dropped' };
const WATCHARR_STATUS = { FINISHED: 'watched', PLANNED: 'to_watch', WATCHING: 'watching', HELD: 'on_hold', DROPPED: 'dropped' };

/** Parse a MAL XML export into neutral import items. */
export function parseMal(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata', parseTagValue: true });
  const doc = parser.parse(xml);
  const list = doc?.myanimelist?.anime;
  if (!list) throw err(400, 'Not a MyAnimeList export (no <anime> entries).');
  const arr = Array.isArray(list) ? list : [list];
  const text = (v) => (v && typeof v === 'object' && '__cdata' in v ? v.__cdata : v);
  return arr.map((a) => ({
    source: 'mal',
    name: String(text(a.series_title) ?? '').trim(),
    external_id: Number(a.series_animedb_id) || null,
    type: String(text(a.series_type) || '').toLowerCase() === 'movie' ? 'movie' : 'tv',
    status: MAL_STATUS[text(a.my_status)] || 'to_watch',
    rating: Number(a.my_score) > 0 ? Math.min(10, Number(a.my_score)) : null,
    rewatch_count: Number(a.my_times_watched) || 0,
    rewatching: Number(a.my_rewatching) === 1,
    watched_episodes: Number(a.my_watched_episodes) || 0,
    start_date: text(a.my_start_date) && text(a.my_start_date) !== '0000-00-00' ? text(a.my_start_date) : null,
    finish_date: text(a.my_finish_date) && text(a.my_finish_date) !== '0000-00-00' ? text(a.my_finish_date) : null,
  }));
}

/** Parse a Watcharr JSON export. */
export function parseWatcharr(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!Array.isArray(data)) throw err(400, 'Not a Watcharr export (expected an array).');
  return data
    .filter((it) => it && it.content)
    .map((it) => ({
      source: 'watcharr',
      name: it.content.title || it.content.name || '',
      tmdb_id: it.content.tmdbId || null,
      type: it.content.type === 'show' || it.content.type === 'tv' ? 'tv' : 'movie',
      status: WATCHARR_STATUS[String(it.status || '').toUpperCase()] || 'to_watch',
      rating: it.rating ? Math.min(10, Number(it.rating)) : null,
      watched_episodes_list: Array.isArray(it.watchedEpisodes)
        ? it.watchedEpisodes.map((e) => ({ season_number: e.seasonNumber, episode_number: e.episodeNumber, watched_at: e.createdAt || null }))
        : null,
      finish_date: it.updatedAt || null,
    }));
}

/** Resolve an import item to a TMDB (type, id). Returns {type, tmdb_id} | {choices} | null. */
export async function resolveItem(item) {
  if (item.tmdb_id && item.type) return { type: item.type, tmdb_id: item.tmdb_id };
  if (item.external_id && item.source === 'mal') {
    try {
      const found = await api.find(item.external_id, 'myanimelist_id');
      const tv = found.tv_results?.[0];
      const mv = found.movie_results?.[0];
      if (tv) return { type: 'tv', tmdb_id: tv.id };
      if (mv) return { type: 'movie', tmdb_id: mv.id };
    } catch (e) {
      if (e.status === 429) throw e;
    }
  }
  if (!item.name) return null;
  const search = await api.multiSearch(item.name);
  const matches = (search.results || []).filter((r) => r.media_type === 'tv' || r.media_type === 'movie');
  if (!matches.length) return null;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const exact = matches.filter((r) => norm(r.name || r.title) === norm(item.name) || norm(r.original_name || r.original_title) === norm(item.name));
  const preferred = exact.find((r) => r.media_type === item.type) || exact[0];
  if (preferred) return { type: preferred.media_type, tmdb_id: preferred.id };
  const typed = matches.filter((r) => r.media_type === item.type);
  if (typed.length === 1) return { type: typed[0].media_type, tmdb_id: typed[0].id };
  return {
    choices: matches.slice(0, 6).map((r) => ({
      type: r.media_type,
      tmdb_id: r.id,
      title: r.name || r.title,
      year: (r.first_air_date || r.release_date || '').slice(0, 4),
      poster_path: r.poster_path || null,
    })),
  };
}

/** Apply a resolved item for a user. Returns { result: 'imported' | 'exists', media }. */
export async function applyItem(db, userId, item, resolved) {
  const media = await ensureMedia(db, resolved.type, resolved.tmdb_id);
  if (getTracking(db, userId, media.id)) return { result: 'exists', media };
  const finishAt = item.finish_date ? new Date(item.finish_date).toISOString() : now();
  db.transaction(() => {
    const status = item.status;
    // Movies: watched/rewatch counts are just completed runs.
    if (media.media_type === 'movie') {
      track(db, userId, media, { status: status === 'watching' ? 'watching' : status, watchedAt: finishAt });
      const extra = status === 'watched' ? item.rewatch_count || 0 : 0;
      for (let i = 0; i < extra; i++) startRewatch(db, userId, media, { watchedAt: finishAt });
    } else {
      track(db, userId, media, { status: status === 'watched' ? 'watched' : 'to_watch', watchedAt: finishAt });
      // Completed previous runs (MAL "times watched" excludes the first completion).
      const previous = status === 'watched' ? item.rewatch_count || 0 : 0;
      if (previous) db.prepare('UPDATE user_media SET watch_count = watch_count + ? WHERE user_id = ? AND media_id = ?').run(previous, userId, media.id);
      if (status !== 'watched') {
        if (item.watched_episodes_list?.length) {
          for (const e of item.watched_episodes_list) {
            try {
              setEpisodeWatched(db, userId, media, e.season_number, e.episode_number, true, { watchedAt: e.watched_at ? new Date(e.watched_at).toISOString() : finishAt });
            } catch {
              /* episode unknown locally */
            }
          }
        } else if (item.watched_episodes > 0) {
          const eps = db.prepare('SELECT season_number, episode_number FROM episodes WHERE media_id = ? AND season_number > 0 ORDER BY season_number, episode_number LIMIT ?').all(media.id, item.watched_episodes);
          const last = eps[eps.length - 1];
          if (last) markUpTo(db, userId, media, { season: last.season_number, episode: last.episode_number, watchedAt: finishAt });
        }
        db.prepare('UPDATE user_media SET status = ? WHERE user_id = ? AND media_id = ?').run(status, userId, media.id);
        if (item.rewatching && item.rewatch_count) {
          db.prepare('UPDATE user_media SET watch_count = ?, active_run = ? WHERE user_id = ? AND media_id = ?').run(item.rewatch_count, item.rewatch_count + 1, userId, media.id);
        }
      }
    }
    if (item.rating) db.prepare('UPDATE user_media SET rating = ? WHERE user_id = ? AND media_id = ?').run(item.rating, userId, media.id);
    if (item.start_date) db.prepare('UPDATE user_media SET started_at = ? WHERE user_id = ? AND media_id = ?').run(new Date(item.start_date).toISOString(), userId, media.id);
  })();
  return { result: 'imported', media };
}
