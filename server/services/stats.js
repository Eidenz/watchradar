// Viewing statistics + the stats snapshot achievements are derived from.
import { calculateAchievements } from '../lib/achievements.js';
import { parseJson } from './media.js';

const completedWhere = `(um.status = 'watched' OR um.watch_count > 0)`;

export function userStats(db, userId, { includePrivate = true } = {}) {
  const priv = includePrivate ? '' : 'AND um.is_private = 0';
  const one = (sql, ...p) => db.prepare(sql).get(userId, ...p);

  const completedTv = one(`SELECT COUNT(*) AS c FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND m.media_type = 'tv' AND ${completedWhere} ${priv}`).c;
  const completedMovies = one(`SELECT COUNT(*) AS c FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND m.media_type = 'movie' AND ${completedWhere} ${priv}`).c;
  const counts = Object.fromEntries(
    db.prepare(`SELECT um.status, COUNT(*) AS c FROM user_media um WHERE um.user_id = ? ${priv} GROUP BY um.status`).all(userId).map((r) => [r.status, r.c])
  );

  // Minutes: episode events × (episode runtime or show runtime), movie events × runtime.
  const tvMinutes = one(
    `SELECT COALESCE(SUM(COALESCE(e.runtime, m.runtime, 0)), 0) AS mins, COUNT(*) AS n
     FROM watch_events w JOIN media m ON m.id = w.media_id JOIN user_media um ON um.media_id = m.id AND um.user_id = w.user_id
     LEFT JOIN episodes e ON e.media_id = w.media_id AND e.season_number = w.season_number AND e.episode_number = w.episode_number
     WHERE w.user_id = ? AND m.media_type = 'tv' AND w.season_number IS NOT NULL ${priv}`
  );
  const movieMinutes = one(
    `SELECT COALESCE(SUM(COALESCE(m.runtime, 0)), 0) AS mins, COUNT(*) AS n
     FROM watch_events w JOIN media m ON m.id = w.media_id JOIN user_media um ON um.media_id = m.id AND um.user_id = w.user_id
     WHERE w.user_id = ? AND m.media_type = 'movie' ${priv}`
  );

  const rated = one(`SELECT COUNT(*) AS c, AVG(um.rating) AS avg FROM user_media um WHERE um.user_id = ? AND um.rating IS NOT NULL ${priv}`);
  const ratingDist = Object.fromEntries(
    db.prepare(`SELECT um.rating, COUNT(*) AS c FROM user_media um WHERE um.user_id = ? AND um.rating IS NOT NULL ${priv} GROUP BY um.rating`).all(userId).map((r) => [r.rating, r.c])
  );
  const perfect = ratingDist[10] || 0;
  const worst = (ratingDist[1] || 0) + (ratingDist[2] || 0);

  const genreRows = db.prepare(`SELECT m.genres FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND ${completedWhere} ${priv}`).all(userId);
  const genreCounts = {};
  for (const r of genreRows) for (const g of parseJson(r.genres, [])) genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
  const genres = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count, percentage: genreRows.length ? Math.round((count / genreRows.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const decades = db
    .prepare(`SELECT (CAST(substr(m.release_date, 1, 4) AS INTEGER) / 10) * 10 AS decade, COUNT(*) AS count FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND ${completedWhere} AND m.release_date IS NOT NULL ${priv} GROUP BY decade ORDER BY decade`)
    .all(userId)
    .filter((r) => r.decade > 1800);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const weekly = one(`SELECT COUNT(*) AS c FROM user_media um WHERE um.user_id = ? AND um.completed_at >= ? ${priv}`, weekAgo).c;
  const monthly = one(`SELECT COUNT(*) AS c FROM user_media um WHERE um.user_id = ? AND um.completed_at >= ? ${priv}`, monthAgo).c;
  const weekend = one(`SELECT COUNT(*) AS c FROM user_media um WHERE um.user_id = ? AND um.completed_at IS NOT NULL AND CAST(strftime('%w', um.completed_at) AS INTEGER) IN (0, 6) ${priv}`).c;
  const classic = one(`SELECT COUNT(*) AS c FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND ${completedWhere} AND substr(m.release_date, 1, 4) < '1990' ${priv}`).c;
  const friendsCount = one(`SELECT COUNT(*) AS c FROM friends WHERE status = 'accepted' AND (user_one_id = ? OR user_two_id = ?)`, userId).c;
  const rewatched = one(`SELECT COUNT(*) AS c FROM user_media um WHERE um.user_id = ? AND um.watch_count >= 2 ${priv}`).c;

  // Activity: viewings per month over the last 12 months.
  const months = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(m.toISOString().slice(0, 7));
  }
  const perMonth = Object.fromEntries(
    db
      .prepare(`SELECT substr(w.watched_at, 1, 7) AS ym, COUNT(*) AS c FROM watch_events w JOIN user_media um ON um.media_id = w.media_id AND um.user_id = w.user_id WHERE w.user_id = ? AND w.watched_at >= ? ${priv} GROUP BY ym`)
      .all(userId, `${months[0]}-01`)
      .map((r) => [r.ym, r.c])
  );
  const activity = months.map((ym) => ({ month: ym, count: perMonth[ym] || 0 }));

  // Day-of-week distribution of viewings.
  const dow = new Array(7).fill(0);
  for (const r of db.prepare(`SELECT CAST(strftime('%w', w.watched_at) AS INTEGER) AS d, COUNT(*) AS c FROM watch_events w JOIN user_media um ON um.media_id = w.media_id AND um.user_id = w.user_id WHERE w.user_id = ? ${priv} GROUP BY d`).all(userId)) dow[r.d] = r.c;

  const mostRewatched = db
    .prepare(`SELECT m.id, m.tmdb_id, m.title, m.original_title, m.original_language, m.alternative_titles, m.poster_path, m.media_type, m.release_date, um.watch_count FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.watch_count >= 2 ${priv} ORDER BY um.watch_count DESC, m.title LIMIT 6`)
    .all(userId);
  const topRated = db
    .prepare(`SELECT m.id, m.tmdb_id, m.title, m.original_title, m.original_language, m.alternative_titles, m.poster_path, m.media_type, m.release_date, um.rating FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.rating IS NOT NULL ${priv} ORDER BY um.rating DESC, um.updated_at DESC LIMIT 6`)
    .all(userId);

  const totalMinutes = tvMinutes.mins + movieMinutes.mins;
  const watchlistCount = counts.to_watch || 0;
  const completedTotal = completedTv + completedMovies;

  const snapshot = {
    completedTv,
    completedMovies,
    completedTotal,
    totalMinutes,
    ratedCount: rated.c,
    genreCounts,
    friendsCount,
    perfectRatings: perfect,
    worstRatings: worst,
    weeklyCompletions: weekly,
    monthlyCompletions: monthly,
    weekendCompletions: weekend,
    classicCompletions: classic,
    uniqueDecades: decades.length,
    uniqueGenres: Object.keys(genreCounts).length,
    watchlistCount,
    watchlistCompletionRate: watchlistCount + completedTotal ? completedTotal / (watchlistCount + completedTotal) : 0,
    rewatchedTitles: rewatched,
  };

  return {
    counts: { ...counts, completed_tv: completedTv, completed_movies: completedMovies, completed_total: completedTotal, rewatched, rated: rated.c },
    episodes_watched: tvMinutes.n,
    movie_viewings: movieMinutes.n,
    minutes: { total: totalMinutes, tv: tvMinutes.mins, movies: movieMinutes.mins },
    average_rating: rated.avg ? Math.round(rated.avg * 10) / 10 : null,
    rating_distribution: Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: ratingDist[i + 1] || 0 })),
    genres,
    decades,
    activity,
    weekdays: dow,
    most_rewatched: mostRewatched,
    top_rated: topRated,
    achievements: calculateAchievements(snapshot),
    friends: friendsCount,
  };
}
