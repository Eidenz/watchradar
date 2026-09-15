import { Router } from 'express';
import { now } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { err, wrap, int, str, page as pageOf } from '../lib/http.js';
import { buildFilters, orderClause, libraryItem } from '../services/library.js';
import { ensureMedia, getMedia } from '../services/media.js';
import { getTracking, track } from '../services/progress.js';

export function listRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  const own = (req) => {
    const list = db.prepare('SELECT * FROM lists WHERE id = ? AND user_id = ?').get(int(req.params.id, 'id', { min: 1 }), req.user.id);
    if (!list) throw err(404, 'List not found.');
    return list;
  };
  const summary = (l) => ({
    ...l,
    item_count: db.prepare('SELECT COUNT(*) AS c FROM list_items WHERE list_id = ?').get(l.id).c,
    posters: db.prepare('SELECT m.poster_path FROM list_items li JOIN media m ON m.id = li.media_id WHERE li.list_id = ? AND m.poster_path IS NOT NULL ORDER BY li.position LIMIT 4').all(l.id).map((x) => x.poster_path),
  });

  r.get('/', (req, res) => {
    const lists = db.prepare('SELECT * FROM lists WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id).map(summary);
    res.json({ lists });
  });

  r.post('/', (req, res) => {
    const name = str(req.body.name, 'name', { max: 100 });
    const description = str(req.body.description, 'description', { max: 1000, optional: true }) || null;
    const ts = now();
    const info = db.prepare('INSERT INTO lists (user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(req.user.id, name, description, ts, ts);
    logActivity(db, { userId: req.user.id, listId: info.lastInsertRowid, type: 'CREATED_LIST', details: { listName: name } });
    res.status(201).json(summary(db.prepare('SELECT * FROM lists WHERE id = ?').get(info.lastInsertRowid)));
  });

  r.get('/:id', (req, res) => {
    const list = own(req);
    const pg = pageOf(req.query, 40);
    const { where, params } = buildFilters(req.query);
    where.unshift('li.list_id = @listId');
    params.listId = list.id;
    const w = `WHERE ${where.join(' AND ')}`;
    const from = `FROM list_items li JOIN media m ON m.id = li.media_id LEFT JOIN user_media um ON um.media_id = m.id AND um.user_id = @userId`;
    params.userId = req.user.id;
    const total = db.prepare(`SELECT COUNT(*) AS c ${from} ${w}`).get(params).c;
    const order = req.query.sort ? orderClause(req.query, 'recently_added', 'asc') : 'ORDER BY li.position ASC, li.added_at ASC';
    const rows = db
      .prepare(
        `SELECT m.*, um.id AS tracking_id, um.status, um.rating, um.is_private, um.watch_count, um.active_run, um.notes, um.started_at, um.completed_at,
           um.created_at AS tracked_at, um.updated_at AS tracking_updated_at, li.position, li.added_at ${from} ${w} ${order.replace('um.created_at', 'li.added_at')} LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: pg.limit, offset: pg.offset });
    const items = rows.map((row) => {
      const { position, added_at, ...rest } = row;
      const item = libraryItem(rest);
      if (!rest.tracking_id) item.tracking = null;
      return { ...item, position, added_at };
    });
    res.json({ list: summary(list), items, page: pg.page, limit: pg.limit, total, pages: Math.max(1, Math.ceil(total / pg.limit)) });
  });

  r.patch('/:id', (req, res) => {
    const list = own(req);
    const name = req.body.name !== undefined ? str(req.body.name, 'name', { max: 100 }) : list.name;
    const description = req.body.description !== undefined ? str(req.body.description, 'description', { max: 1000, optional: true }) || null : list.description;
    db.prepare('UPDATE lists SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(name, description, now(), list.id);
    res.json(summary(db.prepare('SELECT * FROM lists WHERE id = ?').get(list.id)));
  });

  r.delete('/:id', (req, res) => {
    const list = own(req);
    db.prepare('DELETE FROM lists WHERE id = ?').run(list.id);
    res.status(204).end();
  });

  r.post(
    '/:id/items',
    wrap(async (req, res) => {
      const list = own(req);
      let media;
      if (req.body.media_id) media = getMedia(db, int(req.body.media_id, 'media_id', { min: 1 }));
      else if (req.body.tmdb_id && req.body.type) media = await ensureMedia(db, req.body.type === 'movie' ? 'movie' : 'tv', int(req.body.tmdb_id, 'tmdb_id', { min: 1 }));
      if (!media) throw err(404, 'Unknown title.');
      let t = getTracking(db, req.user.id, media.id);
      if (!t) t = track(db, req.user.id, media, { status: 'to_watch' });
      const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM list_items WHERE list_id = ?').get(list.id).p;
      const info = db.prepare('INSERT OR IGNORE INTO list_items (list_id, media_id, position, added_at) VALUES (?, ?, ?, ?)').run(list.id, media.id, pos, now());
      if (info.changes) {
        db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now(), list.id);
        logActivity(db, { userId: req.user.id, mediaId: media.id, listId: list.id, type: 'ADDED_TO_LIST', details: { listName: list.name }, isPrivate: !!t.is_private });
      }
      res.status(201).json(summary(db.prepare('SELECT * FROM lists WHERE id = ?').get(list.id)));
    })
  );

  r.delete('/:id/items/:mediaId', (req, res) => {
    const list = own(req);
    db.prepare('DELETE FROM list_items WHERE list_id = ? AND media_id = ?').run(list.id, int(req.params.mediaId, 'mediaId', { min: 1 }));
    db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?').run(now(), list.id);
    res.status(204).end();
  });

  r.put('/:id/order', (req, res) => {
    const list = own(req);
    const ids = Array.isArray(req.body.media_ids) ? req.body.media_ids.map((x) => Number(x)) : null;
    if (!ids) throw err(400, 'media_ids must be an array.');
    const upd = db.prepare('UPDATE list_items SET position = ? WHERE list_id = ? AND media_id = ?');
    db.transaction(() => ids.forEach((id, i) => upd.run(i + 1, list.id, id)))();
    res.json({ ok: true });
  });

  /** Lists containing a given title (for "add to list" pickers). */
  r.get('/for/:mediaId', (req, res) => {
    const mediaId = int(req.params.mediaId, 'mediaId', { min: 1 });
    const lists = db
      .prepare('SELECT l.id, l.name, EXISTS (SELECT 1 FROM list_items li WHERE li.list_id = l.id AND li.media_id = ?) AS has FROM lists l WHERE l.user_id = ? ORDER BY l.name')
      .all(mediaId, req.user.id)
      .map((l) => ({ ...l, has: !!l.has }));
    res.json({ lists });
  });

  return r;
}
