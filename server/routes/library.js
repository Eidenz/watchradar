import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { page as pageOf, paginate } from '../lib/http.js';
import { listLibrary, statusCounts, home, genreList } from '../services/library.js';
import { parseJson } from '../services/media.js';

export function libraryRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', (req, res) => {
    const pg = pageOf(req.query, 24);
    const out = listLibrary(db, req.user.id, req.query, pg, { withProgress: req.query.status === 'watching' || req.query.progress === '1' });
    res.json({ ...out, counts: statusCounts(db, req.user.id) });
  });

  r.get('/home', (req, res) => res.json(home(db, req.user.id)));
  r.get('/genres', (req, res) => res.json({ genres: genreList() }));
  r.get('/counts', (req, res) => res.json(statusCounts(db, req.user.id)));

  /** Full portable export of the user's data. */
  r.get('/export', (req, res) => {
    const uid = req.user.id;
    const titles = db
      .prepare(
        `SELECT m.tmdb_id, m.media_type, m.title, um.status, um.rating, um.is_private, um.watch_count, um.active_run, um.notes, um.started_at, um.completed_at, um.created_at, um.updated_at, m.id AS media_id
         FROM user_media um JOIN media m ON m.id = um.media_id WHERE um.user_id = ? ORDER BY m.title`
      )
      .all(uid)
      .map((t) => {
        const { media_id, ...rest } = t;
        return {
          ...rest,
          is_private: !!t.is_private,
          watches: db.prepare('SELECT season_number, episode_number, run, watched_at FROM watch_events WHERE user_id = ? AND media_id = ? ORDER BY watched_at').all(uid, media_id),
          cuts: db.prepare('SELECT season_number, after_episode FROM season_cuts WHERE user_id = ? AND media_id = ?').all(uid, media_id),
          comment: db.prepare('SELECT body, updated_at FROM comments WHERE user_id = ? AND media_id = ?').get(uid, media_id) || null,
        };
      });
    const lists = db.prepare('SELECT id, name, description, created_at FROM lists WHERE user_id = ? ORDER BY created_at').all(uid).map((l) => ({
      ...l,
      items: db.prepare('SELECT m.tmdb_id, m.media_type, m.title, li.position, li.added_at FROM list_items li JOIN media m ON m.id = li.media_id WHERE li.list_id = ? ORDER BY li.position').all(l.id),
    }));
    res.setHeader('Content-Disposition', `attachment; filename="watchradar-${req.user.username}-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ format: 'watchradar', version: 2, exported_at: new Date().toISOString(), user: { username: req.user.username }, titles, lists });
  });

  return r;
}

export { paginate, parseJson };
