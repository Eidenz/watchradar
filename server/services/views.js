// Composite read models returned to the client.
import { api, TmdbError } from '../lib/tmdb.js';
import { findMedia, publicMedia, rowFromTmdb, parseJson } from './media.js';
import { getTracking, showProgress, seasonsWithState, getCuts } from './progress.js';

export function trackingView(t) {
  if (!t) return null;
  return {
    id: t.id,
    status: t.status,
    rating: t.rating,
    is_private: !!t.is_private,
    watch_count: t.watch_count,
    active_run: t.active_run,
    is_rewatching: !!t.active_run && t.active_run > t.watch_count,
    notes: t.notes,
    started_at: t.started_at,
    completed_at: t.completed_at,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export function friendIds(db, userId) {
  return db
    .prepare(`SELECT CASE WHEN user_one_id = ? THEN user_two_id ELSE user_one_id END AS id FROM friends WHERE status = 'accepted' AND (user_one_id = ? OR user_two_id = ?)`)
    .all(userId, userId, userId)
    .map((r) => r.id);
}

/** Full title page payload. media may be a DB row or a TMDB-only preview (id null). */
export function titleView(db, media, viewer) {
  const t = viewer && media.id ? getTracking(db, viewer.id, media.id) : null;
  const view = {
    media: publicMedia(media),
    tracking: trackingView(t),
    progress: t && media.media_type === 'tv' ? showProgress(db, viewer.id, media, t) : null,
    seasons: media.id && media.media_type === 'tv' ? seasonsWithState(db, viewer?.id, media, t) : [],
    cuts: t ? getCuts(db, viewer.id, media.id) : [],
    lists: [],
    friends: [],
  };
  if (viewer && media.id) {
    view.lists = db
      .prepare('SELECT l.id, l.name FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.user_id = ? AND li.media_id = ? ORDER BY l.name')
      .all(viewer.id, media.id);
    const ids = friendIds(db, viewer.id);
    if (ids.length) {
      view.friends = db
        .prepare(
          `SELECT u.id, u.username, um.status, um.rating, um.watch_count FROM user_media um JOIN users u ON u.id = um.user_id
           WHERE um.media_id = ? AND um.is_private = 0 AND um.user_id IN (${ids.map(() => '?').join(',')}) ORDER BY u.username`
        )
        .all(media.id, ...ids);
    }
  }
  return view;
}

/** Resolve a (type, tmdbId) to a local row, or a normalised TMDB preview when not cached. */
export async function loadTitle(db, type, tmdbId) {
  const local = findMedia(db, type, tmdbId);
  if (local) return { media: local, cached: true };
  const d = await api.details(type, tmdbId);
  const row = rowFromTmdb(type, d);
  const preview = {
    id: null,
    ...row,
    created_at: null,
    tmdb_synced_at: null,
    preview_seasons: (d.seasons || []).map((s) => ({
      season_number: s.season_number,
      name: s.name,
      overview: s.overview,
      poster_path: s.poster_path,
      air_date: s.air_date,
      episode_count: s.episode_count,
    })),
  };
  return { media: preview, cached: false };
}

export function searchResultView(db, viewer, r) {
  const type = r.media_type;
  const local = findMedia(db, type, r.id);
  const t = viewer && local ? getTracking(db, viewer.id, local.id) : null;
  return {
    type,
    tmdb_id: r.id,
    media_id: local?.id ?? null,
    title: r.name || r.title,
    original_title: r.original_name || r.original_title,
    original_language: r.original_language,
    overview: r.overview,
    poster_path: r.poster_path,
    backdrop_path: r.backdrop_path,
    release_date: r.first_air_date || r.release_date || null,
    vote_average: typeof r.vote_average === 'number' ? Math.round(r.vote_average * 10) / 10 : null,
    genre_ids: r.genre_ids || [],
    tracking: trackingView(t),
  };
}

export { TmdbError, parseJson };
