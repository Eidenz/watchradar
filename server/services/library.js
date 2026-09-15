// Library listing (filters/sort/pagination), home dashboard rails, public profile lists.
import { STATUSES } from '../config.js';
import { today } from '../db.js';
import { publicMedia } from './media.js';
import { showProgress } from './progress.js';

export const SORTS = {
  recently_updated: 'um.updated_at',
  recently_added: 'um.created_at',
  title: 'm.title',
  release_date: 'm.release_date',
  rating: 'um.rating',
  watch_count: 'um.watch_count',
  tmdb_rating: 'm.vote_average',
  runtime: 'm.runtime',
};

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
  'Kids', 'Music', 'Mystery', 'News', 'Reality', 'Romance', 'Science Fiction', 'Sci-Fi & Fantasy', 'Soap', 'Talk', 'Thriller',
  'War', 'War & Politics', 'Western', 'Action & Adventure', 'TV Movie',
];
export const genreList = () => GENRES;

/** Build WHERE fragments shared by private + public listings. */
export function buildFilters(q, { alias = 'um', mediaAlias = 'm' } = {}) {
  const where = [];
  const params = {};
  if (q.status && STATUSES.includes(q.status)) {
    where.push(`${alias}.status = @status`);
    params.status = q.status;
  }
  if (q.type === 'tv' || q.type === 'movie') {
    where.push(`${mediaAlias}.media_type = @type`);
    params.type = q.type;
  }
  if (q.genre) {
    where.push(`${mediaAlias}.genres LIKE @genre`);
    params.genre = `%"name":${JSON.stringify(String(q.genre))}%`;
  }
  if (q.rating === 'unrated') where.push(`${alias}.rating IS NULL`);
  else if (q.rating && Number(q.rating) > 0) {
    where.push(`${alias}.rating >= @rating`);
    params.rating = Number(q.rating);
  }
  if (q.year && /^\d{4}$/.test(String(q.year))) {
    where.push(`substr(${mediaAlias}.release_date, 1, 4) = @year`);
    params.year = String(q.year);
  }
  if (q.decade && /^\d{4}$/.test(String(q.decade))) {
    where.push(`CAST(substr(${mediaAlias}.release_date, 1, 4) AS INTEGER) BETWEEN @decade AND @decade + 9`);
    params.decade = Number(q.decade);
  }
  if (q.search) {
    where.push(`(${mediaAlias}.title LIKE @search OR ${mediaAlias}.original_title LIKE @search OR ${mediaAlias}.alternative_titles LIKE @search)`);
    params.search = `%${String(q.search).replace(/[%_]/g, (c) => `\\${c}`)}%`;
  }
  if (q.rewatched === '1' || q.rewatched === true) where.push(`${alias}.watch_count >= 2`);
  if (q.private === '1') where.push(`${alias}.is_private = 1`);
  return { where, params };
}

export function orderClause(q, fallback = 'recently_updated', fallbackOrder = 'desc') {
  const col = SORTS[q.sort] || SORTS[fallback];
  const dir = q.order === 'asc' || q.order === 'desc' ? q.order : q.sort ? 'desc' : fallbackOrder;
  const nulls = col === 'um.rating' || col === 'm.vote_average' || col === 'm.runtime' ? `${col} IS NULL, ` : '';
  return `ORDER BY ${nulls}${col} ${dir.toUpperCase()}, m.title ASC`;
}

const ITEM_SELECT = `m.*, um.id AS tracking_id, um.status, um.rating, um.is_private, um.watch_count, um.active_run, um.notes,
  um.started_at, um.completed_at, um.created_at AS tracked_at, um.updated_at AS tracking_updated_at`;

export function libraryItem(row, { includeTracking = true } = {}) {
  const { tracking_id, status, rating, is_private, watch_count, active_run, notes, started_at, completed_at, tracked_at, tracking_updated_at, ...m } = row;
  const item = { media: publicMedia(m) };
  if (includeTracking) {
    item.tracking = { id: tracking_id, status, rating, is_private: !!is_private, watch_count, active_run, notes, started_at, completed_at, created_at: tracked_at, updated_at: tracking_updated_at };
  }
  return item;
}

export function listLibrary(db, userId, q, { page, limit, offset }, { withProgress = false } = {}) {
  const { where, params } = buildFilters(q);
  where.unshift('um.user_id = @userId');
  params.userId = userId;
  const w = `WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM user_media um JOIN media m ON m.id = um.media_id ${w}`).get(params).c;
  const rows = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id ${w} ${orderClause(q)} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
  const items = rows.map((r) => {
    const item = libraryItem(r);
    if (withProgress && r.media_type === 'tv') item.progress = showProgress(db, userId, item.media, { id: r.tracking_id, active_run: r.active_run, watch_count: r.watch_count });
    return item;
  });
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function statusCounts(db, userId) {
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM user_media WHERE user_id = ? GROUP BY status').all(userId);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let all = 0;
  for (const r of rows) {
    counts[r.status] = r.c;
    all += r.c;
  }
  return { ...counts, all };
}

/** Home dashboard rails. */
export function home(db, userId) {
  const day = today();
  const watching = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.status = 'watching' ORDER BY um.updated_at DESC LIMIT 60`)
    .all(userId)
    .map((r) => {
      const item = libraryItem(r);
      if (r.media_type === 'tv') item.progress = showProgress(db, userId, item.media, { active_run: r.active_run, watch_count: r.watch_count });
      return item;
    });
  const continueWatching = watching.filter((i) => i.media.media_type === 'movie' || i.progress?.next_episode);
  const caughtUp = watching.filter((i) => i.media.media_type === 'tv' && !i.progress?.next_episode);

  // Completed shows that grew new aired episodes since.
  const completedTv = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.status = 'watched' AND m.media_type = 'tv' AND um.watch_count > 0`)
    .all(userId);
  const newEpisodes = [];
  for (const r of completedTv) {
    const item = libraryItem(r);
    const p = showProgress(db, userId, item.media, { active_run: r.active_run, watch_count: r.watch_count });
    if (p.unwatched_aired > 0) newEpisodes.push({ ...item, progress: p });
  }
  newEpisodes.sort((a, b) => (b.progress.unwatched_aired - a.progress.unwatched_aired));

  // Upcoming episodes in the next 21 days for anything watching/completed/on hold.
  const in21 = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  const upcoming = db
    .prepare(
      `SELECT e.season_number, e.episode_number, e.title AS episode_title, e.air_date, m.id AS media_id, m.title, m.poster_path, m.media_type, m.original_title, m.original_language, m.alternative_titles, m.tmdb_id
       FROM user_media um JOIN media m ON m.id = um.media_id JOIN episodes e ON e.media_id = m.id
       WHERE um.user_id = ? AND um.status IN ('watching', 'watched', 'on_hold', 'to_watch') AND e.season_number > 0 AND e.air_date > ? AND e.air_date <= ?
       ORDER BY e.air_date, m.title, e.season_number, e.episode_number LIMIT 40`
    )
    .all(userId, day, in21);

  const airedToday = db
    .prepare(
      `SELECT e.season_number, e.episode_number, e.title AS episode_title, e.air_date, m.id AS media_id, m.title, m.poster_path, m.media_type, m.original_title, m.original_language, m.alternative_titles, m.tmdb_id
       FROM user_media um JOIN media m ON m.id = um.media_id JOIN episodes e ON e.media_id = m.id
       WHERE um.user_id = ? AND um.status IN ('watching', 'watched', 'on_hold') AND e.season_number > 0 AND e.air_date = ?
       ORDER BY m.title`
    )
    .all(userId, day);

  const planned = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.status = 'to_watch' ORDER BY um.created_at DESC LIMIT 12`)
    .all(userId)
    .map((r) => libraryItem(r));

  const recentlyCompleted = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.status = 'watched' ORDER BY COALESCE(um.completed_at, um.updated_at) DESC LIMIT 12`)
    .all(userId)
    .map((r) => libraryItem(r));

  return { continue_watching: continueWatching, caught_up: caughtUp, new_episodes: newEpisodes, upcoming, aired_today: airedToday, planned, recently_completed: recentlyCompleted, counts: statusCounts(db, userId) };
}

/** Public listing of someone's library (respects per-title privacy unless owner). */
export function listPublic(db, profileUserId, q, { page, limit, offset }, isOwner) {
  const { where, params } = buildFilters(q);
  where.unshift('um.user_id = @userId');
  if (!isOwner) where.push('um.is_private = 0');
  if (!q.status) where.push(`(um.status = 'watched' OR um.watch_count > 0)`);
  params.userId = profileUserId;
  const w = `WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM user_media um JOIN media m ON m.id = um.media_id ${w}`).get(params).c;
  const rows = db
    .prepare(`SELECT ${ITEM_SELECT} FROM user_media um JOIN media m ON m.id = um.media_id ${w} ${orderClause(q)} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
  const items = rows.map((r) => {
    const item = libraryItem(r);
    delete item.tracking.notes;
    return item;
  });
  return { items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
