// Media catalogue: mirrors TMDB titles/seasons/episodes into SQLite and reconciles changes.
import { api } from '../lib/tmdb.js';
import { now } from '../db.js';

const TV_LIST = 'id, tmdb_id, media_type, title, original_title, original_language, alternative_titles, overview, poster_path, backdrop_path, release_date, runtime, genres, tmdb_status, in_production, number_of_seasons, number_of_episodes, next_air_date, last_air_date, vote_average, tmdb_synced_at, created_at';

export function parseJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/** Normalise a TMDB details payload (movie or tv) into a media row. */
export function rowFromTmdb(type, d) {
  let runtime = null;
  if (type === 'movie' && d.runtime) runtime = d.runtime;
  else if (type === 'tv' && Array.isArray(d.episode_run_time) && d.episode_run_time.length) runtime = d.episode_run_time[0];
  else if (type === 'tv' && d.last_episode_to_air?.runtime) runtime = d.last_episode_to_air.runtime;
  const alts = d.alternative_titles?.titles || d.alternative_titles?.results || [];
  return {
    tmdb_id: d.id,
    media_type: type,
    title: d.name || d.title || 'Untitled',
    original_title: d.original_name || d.original_title || null,
    original_language: d.original_language || null,
    alternative_titles: alts.length ? JSON.stringify(alts.map((t) => ({ iso_3166_1: t.iso_3166_1, title: t.title }))) : null,
    overview: d.overview || null,
    poster_path: d.poster_path || null,
    backdrop_path: d.backdrop_path || null,
    release_date: d.first_air_date || d.release_date || null,
    runtime,
    genres: Array.isArray(d.genres) ? JSON.stringify(d.genres.map((g) => ({ id: g.id, name: g.name }))) : null,
    tmdb_status: d.status || null,
    in_production: d.in_production ? 1 : 0,
    number_of_seasons: d.number_of_seasons ?? null,
    number_of_episodes: d.number_of_episodes ?? null,
    next_air_date: d.next_episode_to_air?.air_date || null,
    last_air_date: d.last_air_date || null,
    vote_average: typeof d.vote_average === 'number' ? Math.round(d.vote_average * 10) / 10 : null,
  };
}

export const getMedia = (db, id) => db.prepare(`SELECT ${TV_LIST} FROM media WHERE id = ?`).get(id);
export const findMedia = (db, type, tmdbId) =>
  db.prepare(`SELECT ${TV_LIST} FROM media WHERE media_type = ? AND tmdb_id = ?`).get(type, tmdbId);

export function upsertMediaRow(db, row) {
  const existing = findMedia(db, row.media_type, row.tmdb_id);
  const ts = now();
  if (existing) {
    db.prepare(
      `UPDATE media SET title=@title, original_title=@original_title, original_language=@original_language,
        alternative_titles=@alternative_titles, overview=@overview, poster_path=@poster_path, backdrop_path=@backdrop_path,
        release_date=@release_date, runtime=@runtime, genres=@genres, tmdb_status=@tmdb_status, in_production=@in_production,
        number_of_seasons=@number_of_seasons, number_of_episodes=@number_of_episodes, next_air_date=@next_air_date,
        last_air_date=@last_air_date, vote_average=@vote_average, tmdb_synced_at=@synced WHERE id=@id`
    ).run({ ...row, synced: ts, id: existing.id });
    return getMedia(db, existing.id);
  }
  const info = db
    .prepare(
      `INSERT INTO media (tmdb_id, media_type, title, original_title, original_language, alternative_titles, overview, poster_path,
        backdrop_path, release_date, runtime, genres, tmdb_status, in_production, number_of_seasons, number_of_episodes,
        next_air_date, last_air_date, vote_average, tmdb_synced_at, created_at)
       VALUES (@tmdb_id, @media_type, @title, @original_title, @original_language, @alternative_titles, @overview, @poster_path,
        @backdrop_path, @release_date, @runtime, @genres, @tmdb_status, @in_production, @number_of_seasons, @number_of_episodes,
        @next_air_date, @last_air_date, @vote_average, @synced, @synced)`
    )
    .run({ ...row, synced: ts });
  return getMedia(db, info.lastInsertRowid);
}

/**
 * Sync seasons + episodes of a TV title from TMDB. Upserts by (season, episode) so user
 * progress keyed on those numbers survives; episodes that vanished from TMDB are only
 * deleted when nobody has a watch event on them. Returns what changed.
 */
export async function syncSeasons(db, media, details) {
  const d = details || (await api.details('tv', media.tmdb_id));
  const seasons = (d.seasons || []).filter((s) => typeof s.season_number === 'number');
  const before = {
    seasons: new Set(db.prepare('SELECT season_number FROM seasons WHERE media_id = ?').all(media.id).map((r) => r.season_number)),
    episodes: new Set(
      db.prepare('SELECT season_number, episode_number FROM episodes WHERE media_id = ?').all(media.id).map((r) => `${r.season_number}:${r.episode_number}`)
    ),
  };
  const seen = { seasons: new Set(), episodes: new Set() };
  const diff = { newSeasons: [], newEpisodes: [], removedEpisodes: 0 };

  const upSeason = db.prepare(
    `INSERT INTO seasons (media_id, season_number, tmdb_id, name, overview, poster_path, air_date, episode_count)
     VALUES (@media_id, @season_number, @tmdb_id, @name, @overview, @poster_path, @air_date, @episode_count)
     ON CONFLICT(media_id, season_number) DO UPDATE SET tmdb_id=excluded.tmdb_id, name=excluded.name, overview=excluded.overview,
       poster_path=excluded.poster_path, air_date=excluded.air_date, episode_count=excluded.episode_count`
  );
  const upEpisode = db.prepare(
    `INSERT INTO episodes (media_id, season_number, episode_number, tmdb_id, title, overview, air_date, runtime, still_path)
     VALUES (@media_id, @season_number, @episode_number, @tmdb_id, @title, @overview, @air_date, @runtime, @still_path)
     ON CONFLICT(media_id, season_number, episode_number) DO UPDATE SET tmdb_id=excluded.tmdb_id, title=excluded.title,
       overview=excluded.overview, air_date=excluded.air_date, runtime=excluded.runtime, still_path=excluded.still_path`
  );

  // Fetch every season first (network), then write in one transaction.
  const fetched = [];
  for (const s of seasons) {
    try {
      const sd = await api.season(media.tmdb_id, s.season_number);
      fetched.push({ meta: s, episodes: sd.episodes || [] });
    } catch (e) {
      if (e.status === 404) fetched.push({ meta: s, episodes: [] });
      else throw e;
    }
  }

  db.transaction(() => {
    for (const { meta: s, episodes } of fetched) {
      seen.seasons.add(s.season_number);
      if (!before.seasons.has(s.season_number)) diff.newSeasons.push(s.season_number);
      upSeason.run({
        media_id: media.id,
        season_number: s.season_number,
        tmdb_id: s.id ?? null,
        name: s.name || `Season ${s.season_number}`,
        overview: s.overview || null,
        poster_path: s.poster_path || null,
        air_date: s.air_date || null,
        episode_count: episodes.length || s.episode_count || 0,
      });
      for (const ep of episodes) {
        const key = `${ep.season_number}:${ep.episode_number}`;
        seen.episodes.add(key);
        if (!before.episodes.has(key)) diff.newEpisodes.push({ season_number: ep.season_number, episode_number: ep.episode_number, air_date: ep.air_date || null, title: ep.name || null });
        upEpisode.run({
          media_id: media.id,
          season_number: ep.season_number,
          episode_number: ep.episode_number,
          tmdb_id: ep.id ?? null,
          title: ep.name || null,
          overview: ep.overview || null,
          air_date: ep.air_date || null,
          runtime: ep.runtime ?? null,
          still_path: ep.still_path || null,
        });
      }
    }
    // Remove vanished rows (episodes only when unwatched by everyone).
    const staleEpisodes = db.prepare('SELECT season_number, episode_number FROM episodes WHERE media_id = ?').all(media.id)
      .filter((r) => !seen.episodes.has(`${r.season_number}:${r.episode_number}`));
    const hasEvents = db.prepare('SELECT 1 FROM watch_events WHERE media_id = ? AND season_number = ? AND episode_number = ? LIMIT 1');
    const delEp = db.prepare('DELETE FROM episodes WHERE media_id = ? AND season_number = ? AND episode_number = ?');
    for (const r of staleEpisodes) {
      if (!hasEvents.get(media.id, r.season_number, r.episode_number)) {
        delEp.run(media.id, r.season_number, r.episode_number);
        diff.removedEpisodes++;
      }
    }
    const delSeason = db.prepare('DELETE FROM seasons WHERE media_id = ? AND season_number = ? AND NOT EXISTS (SELECT 1 FROM episodes e WHERE e.media_id = seasons.media_id AND e.season_number = seasons.season_number)');
    for (const n of before.seasons) if (!seen.seasons.has(n)) delSeason.run(media.id, n);
  })();
  return diff;
}

/** Ensure a title exists locally (fetching from TMDB if needed). Returns the media row. */
export async function ensureMedia(db, type, tmdbId) {
  const existing = findMedia(db, type, tmdbId);
  if (existing) {
    if (type === 'tv') {
      const n = db.prepare('SELECT COUNT(*) AS c FROM episodes WHERE media_id = ?').get(existing.id).c;
      if (!n) await syncSeasons(db, existing);
    }
    return existing;
  }
  const d = await api.details(type, tmdbId);
  const media = upsertMediaRow(db, rowFromTmdb(type, d));
  if (type === 'tv') await syncSeasons(db, media, d);
  return media;
}

/** Re-pull everything for one title. Never touches user data (cuts, events, ratings). */
export async function refreshMedia(db, mediaId) {
  const media = getMedia(db, mediaId);
  if (!media) return null;
  const d = await api.details(media.media_type, media.tmdb_id);
  const updated = upsertMediaRow(db, rowFromTmdb(media.media_type, d));
  let diff = { newSeasons: [], newEpisodes: [], removedEpisodes: 0 };
  if (media.media_type === 'tv') diff = await syncSeasons(db, updated, d);
  return { media: getMedia(db, mediaId), diff };
}

export const getSeasons = (db, mediaId) =>
  db.prepare('SELECT season_number, tmdb_id, name, overview, poster_path, air_date, episode_count FROM seasons WHERE media_id = ? ORDER BY season_number').all(mediaId);

export const getEpisodes = (db, mediaId, seasonNumber) =>
  db
    .prepare('SELECT season_number, episode_number, tmdb_id, title, overview, air_date, runtime, still_path FROM episodes WHERE media_id = ? AND season_number = ? ORDER BY episode_number')
    .all(mediaId, seasonNumber);

export const publicMedia = (m) =>
  m && {
    ...m,
    genres: parseJson(m.genres, []),
    alternative_titles: parseJson(m.alternative_titles, []),
    in_production: !!m.in_production,
  };
