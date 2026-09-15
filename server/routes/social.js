// Friends, activity feed, user search, public profiles.
import { Router } from 'express';
import { now } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { err, int, str, page as pageOf } from '../lib/http.js';
import { listPublic } from '../services/library.js';
import { userStats } from '../services/stats.js';
import { friendIds } from '../services/views.js';
import { parseJson } from '../services/media.js';

const pair = (a, b) => [Math.min(a, b), Math.max(a, b)];

export function friendship(db, me, other) {
  if (me === other) return 'self';
  const [a, b] = pair(me, other);
  const f = db.prepare('SELECT * FROM friends WHERE user_one_id = ? AND user_two_id = ?').get(a, b);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'accepted';
  return f.action_user_id === me ? 'pending_them' : 'pending_me';
}

export function socialRoutes(db) {
  const r = Router();

  // ---- Friends ----------------------------------------------------------------------
  const f = Router();
  f.use(requireAuth);

  f.get('/', (req, res) => {
    const me = req.user.id;
    const friends = db
      .prepare(
        `SELECT u.id, u.username, f.updated_at AS since FROM friends f
         JOIN users u ON u.id = CASE WHEN f.user_one_id = ? THEN f.user_two_id ELSE f.user_one_id END
         WHERE f.status = 'accepted' AND (f.user_one_id = ? OR f.user_two_id = ?) ORDER BY u.username COLLATE NOCASE`
      )
      .all(me, me, me);
    const incoming = db
      .prepare(`SELECT u.id, u.username, f.created_at FROM friends f JOIN users u ON u.id = f.action_user_id WHERE f.status = 'pending' AND f.action_user_id != ? AND (f.user_one_id = ? OR f.user_two_id = ?) ORDER BY f.created_at DESC`)
      .all(me, me, me);
    const outgoing = db
      .prepare(
        `SELECT u.id, u.username, f.created_at FROM friends f JOIN users u ON u.id = CASE WHEN f.user_one_id = ? THEN f.user_two_id ELSE f.user_one_id END
         WHERE f.status = 'pending' AND f.action_user_id = ? ORDER BY f.created_at DESC`
      )
      .all(me, me);
    res.json({ friends, incoming, outgoing });
  });

  f.get('/status/:userId', (req, res) => res.json({ status: friendship(db, req.user.id, int(req.params.userId, 'userId', { min: 1 })) }));

  f.post('/request/:userId', (req, res) => {
    const other = int(req.params.userId, 'userId', { min: 1 });
    if (other === req.user.id) throw err(400, 'You cannot befriend yourself.');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(other)) throw err(404, 'User not found.');
    const [a, b] = pair(req.user.id, other);
    const existing = db.prepare('SELECT * FROM friends WHERE user_one_id = ? AND user_two_id = ?').get(a, b);
    if (existing) {
      if (existing.status === 'pending' && existing.action_user_id !== req.user.id) {
        db.prepare('UPDATE friends SET status = ?, action_user_id = ?, updated_at = ? WHERE id = ?').run('accepted', req.user.id, now(), existing.id);
        return res.json({ status: 'accepted' });
      }
      throw err(409, existing.status === 'accepted' ? 'You are already friends.' : 'Request already sent.');
    }
    const ts = now();
    db.prepare('INSERT INTO friends (user_one_id, user_two_id, status, action_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(a, b, 'pending', req.user.id, ts, ts);
    res.status(201).json({ status: 'pending_them' });
  });

  f.post('/accept/:userId', (req, res) => {
    const other = int(req.params.userId, 'userId', { min: 1 });
    const [a, b] = pair(req.user.id, other);
    const existing = db.prepare('SELECT * FROM friends WHERE user_one_id = ? AND user_two_id = ?').get(a, b);
    if (!existing || existing.status !== 'pending' || existing.action_user_id === req.user.id) throw err(400, 'No pending request from that user.');
    db.prepare('UPDATE friends SET status = ?, action_user_id = ?, updated_at = ? WHERE id = ?').run('accepted', req.user.id, now(), existing.id);
    res.json({ status: 'accepted' });
  });

  f.delete('/:userId', (req, res) => {
    const [a, b] = pair(req.user.id, int(req.params.userId, 'userId', { min: 1 }));
    db.prepare('DELETE FROM friends WHERE user_one_id = ? AND user_two_id = ?').run(a, b);
    res.json({ status: 'none' });
  });

  r.use('/friends', f);

  // ---- User search --------------------------------------------------------------------
  r.get('/users/search', requireAuth, (req, res) => {
    const q = str(req.query.q, 'q', { max: 50 });
    const rows = db
      .prepare('SELECT id, username FROM users WHERE username LIKE ? AND id != ? ORDER BY username COLLATE NOCASE LIMIT 10')
      .all(`%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`, req.user.id)
      .map((u) => ({ ...u, friendship: friendship(db, req.user.id, u.id) }));
    res.json({ users: rows });
  });

  // ---- Feed -----------------------------------------------------------------------------
  r.get('/feed', requireAuth, (req, res) => {
    const me = req.user.id;
    const pg = pageOf(req.query, 30);
    const scope = req.query.scope === 'me' ? 'me' : req.query.scope === 'all' ? 'all' : 'friends';
    let ids = [];
    if (scope === 'me') ids = [me];
    else if (scope === 'all') ids = [me, ...friendIds(db, me)];
    else ids = friendIds(db, me);
    if (!ids.length) return res.json({ items: [], page: 1, pages: 1, total: 0, scope });
    const ph = ids.map(() => '?').join(',');
    const where = `WHERE a.user_id IN (${ph}) AND (a.is_private = 0 OR a.user_id = ?)`;
    const total = db.prepare(`SELECT COUNT(*) AS c FROM activities a ${where}`).get(...ids, me).c;
    const items = db
      .prepare(
        `SELECT a.id, a.type, a.details, a.created_at, u.id AS user_id, u.username,
           m.id AS media_id, m.tmdb_id, m.media_type, m.title, m.original_title, m.original_language, m.alternative_titles, m.poster_path,
           l.id AS list_id, l.name AS list_name
         FROM activities a JOIN users u ON u.id = a.user_id LEFT JOIN media m ON m.id = a.media_id LEFT JOIN lists l ON l.id = a.list_id
         ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`
      )
      .all(...ids, me, pg.limit, pg.offset)
      .map((row) => ({
        id: row.id,
        type: row.type,
        details: parseJson(row.details, null),
        created_at: row.created_at,
        user: { id: row.user_id, username: row.username },
        media: row.media_id
          ? { id: row.media_id, tmdb_id: row.tmdb_id, media_type: row.media_type, title: row.title, original_title: row.original_title, original_language: row.original_language, alternative_titles: parseJson(row.alternative_titles, []), poster_path: row.poster_path }
          : null,
        list: row.list_id ? { id: row.list_id, name: row.list_name } : null,
      }));
    res.json({ items, page: pg.page, pages: Math.max(1, Math.ceil(total / pg.limit)), total, scope });
  });

  // ---- Public profiles -----------------------------------------------------------------
  function loadProfile(db, req) {
    const user = db.prepare('SELECT id, username, profile_privacy, created_at FROM users WHERE username = ?').get(req.params.username);
    if (!user) throw err(404, 'User not found.');
    const viewer = req.user;
    const isOwner = !!viewer && viewer.id === user.id;
    let access = 'public';
    if (!isOwner) {
      if (user.profile_privacy === 'private') access = 'private';
      else if (user.profile_privacy === 'users_only' && !viewer) access = 'login_required';
      else if (user.profile_privacy === 'friends_only') {
        if (!viewer) access = 'friends_only';
        else if (friendship(db, viewer.id, user.id) !== 'accepted') access = 'friends_only';
      }
    }
    return { user, isOwner, access, friendshipStatus: viewer && !isOwner ? friendship(db, viewer.id, user.id) : isOwner ? 'self' : null };
  }

  r.get('/users/:username', (req, res) => {
    const { user, isOwner, access, friendshipStatus } = loadProfile(db, req);
    const base = { user: { id: user.id, username: user.username, created_at: user.created_at, profile_privacy: isOwner ? user.profile_privacy : undefined }, is_owner: isOwner, access, friendship: friendshipStatus };
    if (access !== 'public') return res.json(base);
    const stats = userStats(db, user.id, { includePrivate: isOwner });
    const priv = isOwner ? '' : 'AND um.is_private = 0';
    const sel = `m.id, m.tmdb_id, m.media_type, m.title, m.original_title, m.original_language, m.alternative_titles, m.poster_path, m.release_date, um.rating, um.watch_count, um.status`;
    const recent = db
      .prepare(`SELECT ${sel}, COALESCE(um.completed_at, um.updated_at) AS at FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND (um.status = 'watched' OR um.watch_count > 0) ${priv} ORDER BY at DESC LIMIT 12`)
      .all(user.id)
      .map(fmtCard);
    const watching = db
      .prepare(`SELECT ${sel}, um.updated_at AS at FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.status = 'watching' ${priv} ORDER BY um.updated_at DESC LIMIT 12`)
      .all(user.id)
      .map(fmtCard);
    const favorites = db
      .prepare(`SELECT ${sel}, um.updated_at AS at FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? AND um.rating >= 9 ${priv} ORDER BY um.rating DESC, um.updated_at DESC LIMIT 12`)
      .all(user.id)
      .map(fmtCard);
    res.json({
      ...base,
      stats: { completed_tv: stats.counts.completed_tv, completed_movies: stats.counts.completed_movies, episodes: stats.episodes_watched, minutes: stats.minutes.total, rated: stats.counts.rated, friends: stats.friends, rewatched: stats.counts.rewatched },
      achievements: stats.achievements,
      genres: stats.genres.slice(0, 6),
      recent,
      watching,
      favorites,
    });
  });

  r.get('/users/:username/library', (req, res) => {
    const { user, isOwner, access } = loadProfile(db, req);
    if (access !== 'public') throw err(403, access === 'login_required' ? 'Sign in to view this profile.' : 'This profile is private.');
    const pg = pageOf(req.query, 24);
    res.json({ ...listPublic(db, user.id, req.query, pg, isOwner), user: { id: user.id, username: user.username } });
  });

  return r;
}

function fmtCard(row) {
  return {
    media: { id: row.id, tmdb_id: row.tmdb_id, media_type: row.media_type, title: row.title, original_title: row.original_title, original_language: row.original_language, alternative_titles: parseJson(row.alternative_titles, []), poster_path: row.poster_path, release_date: row.release_date },
    tracking: { rating: row.rating, watch_count: row.watch_count, status: row.status },
    at: row.at,
  };
}
