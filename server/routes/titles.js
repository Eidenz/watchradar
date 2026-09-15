// Title pages (public + tracked) and everything a user does to a tracked title.
import { Router } from 'express';
import { MEDIA_TYPES, STATUSES } from '../config.js';
import { now } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { err, wrap, int, str, oneOf } from '../lib/http.js';
import { ensureMedia, getMedia, refreshMedia } from '../services/media.js';
import * as P from '../services/progress.js';
import { titleView, loadTitle, friendIds } from '../services/views.js';

const isoDate = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw err(400, 'Invalid date.');
  return d.toISOString();
};

export function titleRoutes(db) {
  const r = Router();

  const typeParam = (v) => oneOf(v, MEDIA_TYPES, 'type');

  // --- Public title page ------------------------------------------------------------
  r.get(
    '/titles/:type/:tmdbId',
    wrap(async (req, res) => {
      const type = typeParam(req.params.type);
      const tmdbId = int(req.params.tmdbId, 'tmdbId', { min: 1 });
      const { media } = await loadTitle(db, type, tmdbId);
      res.json(titleView(db, media, req.user));
    })
  );

  r.get('/titles/:type/:tmdbId/seasons/:n', (req, res) => {
    const type = typeParam(req.params.type);
    const tmdbId = int(req.params.tmdbId, 'tmdbId', { min: 1 });
    const n = int(req.params.n, 'season', { min: 0 });
    const media = db.prepare('SELECT id, media_type FROM media WHERE media_type = ? AND tmdb_id = ?').get(type, tmdbId);
    if (!media) throw err(404, 'Unknown title.');
    const t = req.user ? P.getTracking(db, req.user.id, media.id) : null;
    res.json({ episodes: P.episodesWithState(db, req.user?.id ?? null, media, t, n) });
  });

  r.get('/titles/:type/:tmdbId/comments', (req, res) => {
    const type = typeParam(req.params.type);
    const tmdbId = int(req.params.tmdbId, 'tmdbId', { min: 1 });
    if (!req.user) return res.json({ comments: [] });
    const media = db.prepare('SELECT id FROM media WHERE media_type = ? AND tmdb_id = ?').get(type, tmdbId);
    if (!media) return res.json({ comments: [] });
    const ids = [req.user.id, ...friendIds(db, req.user.id)];
    const comments = db
      .prepare(
        `SELECT c.id, c.user_id, u.username, c.body, c.created_at, c.updated_at FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.media_id = ? AND c.user_id IN (${ids.map(() => '?').join(',')}) AND (c.is_private = 0 OR c.user_id = ?) ORDER BY c.updated_at DESC`
      )
      .all(media.id, ...ids, req.user.id);
    res.json({ comments });
  });

  r.post(
    '/titles/:type/:tmdbId/track',
    requireAuth,
    wrap(async (req, res) => {
      const type = typeParam(req.params.type);
      const tmdbId = int(req.params.tmdbId, 'tmdbId', { min: 1 });
      const status = req.body.status ? oneOf(req.body.status, STATUSES, 'status') : 'to_watch';
      const media = await ensureMedia(db, type, tmdbId);
      P.track(db, req.user.id, media, { status, watchedAt: isoDate(req.body.watched_at) });
      if (req.body.list_id) {
        const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(req.body.list_id, req.user.id);
        if (list) {
          const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM list_items WHERE list_id = ?').get(list.id).p;
          db.prepare('INSERT OR IGNORE INTO list_items (list_id, media_id, position, added_at) VALUES (?, ?, ?, ?)').run(list.id, media.id, pos, now());
        }
      }
      res.status(201).json(titleView(db, getMedia(db, media.id), req.user));
    })
  );

  // --- Tracked title operations (internal media id) -----------------------------------
  const m = Router({ mergeParams: true });
  r.use('/media/:id', requireAuth, (req, res, next) => {
    const id = int(req.params.id, 'id', { min: 1 });
    const media = getMedia(db, id);
    if (!media) return next(err(404, 'Unknown title.'));
    req.media = media;
    next();
  }, m);

  const view = (req) => titleView(db, getMedia(db, req.media.id), req.user);
  const tracked = (req) => {
    const t = P.getTracking(db, req.user.id, req.media.id);
    if (!t) throw err(404, 'You do not track this title.');
    return t;
  };

  m.get('/', (req, res) => res.json(view(req)));

  m.delete('/', (req, res) => {
    P.untrack(db, req.user.id, req.media.id);
    res.status(204).end();
  });

  m.patch('/status', (req, res) => {
    P.setStatus(db, req.user.id, req.media, oneOf(req.body.status, STATUSES, 'status'), { watchedAt: isoDate(req.body.watched_at) });
    res.json(view(req));
  });

  m.patch('/rating', (req, res) => {
    const rating = req.body.rating === null || req.body.rating === '' ? null : int(req.body.rating, 'rating', { min: 1, max: 10 });
    P.setRating(db, req.user.id, req.media, rating);
    res.json(view(req));
  });

  m.patch('/privacy', (req, res) => {
    P.setPrivacy(db, req.user.id, req.media.id, !!req.body.is_private);
    res.json(view(req));
  });

  m.patch('/notes', (req, res) => {
    P.setNotes(db, req.user.id, req.media.id, str(req.body.notes, 'notes', { max: 4000, optional: true }));
    res.json(view(req));
  });

  m.post(
    '/refresh',
    wrap(async (req, res) => {
      tracked(req);
      const out = await refreshMedia(db, req.media.id);
      res.json({ ...view(req), diff: out.diff });
    })
  );

  m.get('/seasons/:n', (req, res) => {
    const n = int(req.params.n, 'season', { min: 0 });
    const t = P.getTracking(db, req.user.id, req.media.id);
    res.json({ episodes: P.episodesWithState(db, req.user.id, req.media, t, n) });
  });

  m.post('/episodes', (req, res) => {
    tracked(req);
    const s = int(req.body.season, 'season', { min: 0 });
    const e = int(req.body.episode, 'episode', { min: 0 });
    const out = P.setEpisodeWatched(db, req.user.id, req.media, s, e, req.body.watched !== false, { watchedAt: isoDate(req.body.watched_at) });
    res.json({ ...view(req), completed: out.completed });
  });

  m.post('/episodes/mark', (req, res) => {
    tracked(req);
    const mode = oneOf(req.body.mode || 'up_to', ['up_to', 'season'], 'mode');
    const season = int(req.body.season, 'season', { min: 0 });
    const episode = int(req.body.episode, 'episode', { min: 0, optional: true });
    if (mode === 'up_to' && episode === undefined) throw err(400, 'episode is required');
    const out = P.markUpTo(db, req.user.id, req.media, { season, episode, seasonOnly: mode === 'season', watchedAt: isoDate(req.body.watched_at) });
    res.json({ ...view(req), completed: out.completed, marked: out.marked });
  });

  m.post('/episodes/unmark', (req, res) => {
    tracked(req);
    P.unmarkSeason(db, req.user.id, req.media, int(req.body.season, 'season', { min: 0 }));
    res.json(view(req));
  });

  m.post('/episodes/rewatch', (req, res) => {
    tracked(req);
    const s = int(req.body.season, 'season', { min: 0 });
    const e = int(req.body.episode, 'episode', { min: 0 });
    const count = req.body.undo ? P.undoRewatchEpisode(db, req.user.id, req.media, s, e) : P.rewatchEpisode(db, req.user.id, req.media, s, e, { watchedAt: isoDate(req.body.watched_at) });
    res.json({ play_count: count });
  });

  m.post('/rewatch', (req, res) => {
    P.startRewatch(db, req.user.id, req.media, { watchedAt: isoDate(req.body.watched_at) });
    res.json(view(req));
  });

  m.delete('/rewatch', (req, res) => {
    P.cancelRewatch(db, req.user.id, req.media);
    res.json(view(req));
  });

  m.get('/history', (req, res) => {
    tracked(req);
    res.json({ events: P.history(db, req.user.id, req.media.id) });
  });

  m.delete('/history/:eventId', (req, res) => {
    P.deleteEvent(db, req.user.id, req.media, int(req.params.eventId, 'eventId', { min: 1 }));
    res.json(view(req));
  });

  m.post('/cuts', (req, res) => {
    tracked(req);
    P.addCut(db, req.user.id, req.media, int(req.body.season, 'season', { min: 0 }), int(req.body.after, 'after', { min: 1 }));
    res.json(view(req));
  });

  m.delete('/cuts/:cutId', (req, res) => {
    P.removeCut(db, req.user.id, req.media.id, int(req.params.cutId, 'cutId', { min: 1 }));
    res.json(view(req));
  });

  m.put('/comment', (req, res) => {
    const t = tracked(req);
    const body = str(req.body.body, 'comment', { max: 2000 });
    const ts = now();
    db.prepare(
      `INSERT INTO comments (user_id, media_id, body, is_private, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, media_id) DO UPDATE SET body = excluded.body, is_private = excluded.is_private, updated_at = excluded.updated_at`
    ).run(req.user.id, req.media.id, body, t.is_private ? 1 : 0, ts, ts);
    res.json(db.prepare('SELECT c.id, c.user_id, u.username, c.body, c.created_at, c.updated_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.user_id = ? AND c.media_id = ?').get(req.user.id, req.media.id));
  });

  m.delete('/comment', (req, res) => {
    db.prepare('DELETE FROM comments WHERE user_id = ? AND media_id = ?').run(req.user.id, req.media.id);
    res.status(204).end();
  });

  return r;
}
