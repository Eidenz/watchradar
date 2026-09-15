// Stats, notifications, import, admin, oEmbed.
import { Router } from 'express';
import { now } from '../db.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { err, wrap, int, str, oneOf, page as pageOf } from '../lib/http.js';
import { achievementCatalog } from '../lib/achievements.js';
import { img } from '../lib/tmdb.js';
import { preferredTitle } from '../lib/titles.js';
import { userStats } from '../services/stats.js';
import { parseMal, parseWatcharr, resolveItem, applyItem } from '../services/importer.js';
import { parseJson } from '../services/media.js';

export function miscRoutes(db, { scheduler } = {}) {
  const r = Router();

  r.get('/stats', requireAuth, (req, res) => res.json(userStats(db, req.user.id)));
  r.get('/achievements', (req, res) => res.json({ achievements: achievementCatalog() }));

  // ---- Notifications --------------------------------------------------------------------
  r.get('/notifications', requireAuth, (req, res) => {
    const pg = pageOf(req.query, 30);
    const unreadOnly = req.query.unread === '1';
    const w = `WHERE n.user_id = ? ${unreadOnly ? 'AND n.read_at IS NULL' : ''}`;
    const total = db.prepare(`SELECT COUNT(*) AS c FROM notifications n ${w}`).get(req.user.id).c;
    const items = db
      .prepare(
        `SELECT n.id, n.type, n.payload, n.read_at, n.created_at, m.id AS media_id, m.tmdb_id, m.media_type, m.title, m.original_title, m.original_language, m.alternative_titles, m.poster_path
         FROM notifications n LEFT JOIN media m ON m.id = n.media_id ${w} ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`
      )
      .all(req.user.id, pg.limit, pg.offset)
      .map((n) => ({
        id: n.id,
        type: n.type,
        payload: parseJson(n.payload, {}),
        read: !!n.read_at,
        created_at: n.created_at,
        media: n.media_id ? { id: n.media_id, tmdb_id: n.tmdb_id, media_type: n.media_type, title: n.title, original_title: n.original_title, original_language: n.original_language, alternative_titles: parseJson(n.alternative_titles, []), poster_path: n.poster_path } : null,
      }));
    const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).c;
    res.json({ items, total, unread, page: pg.page, pages: Math.max(1, Math.ceil(total / pg.limit)) });
  });

  r.post('/notifications/read', requireAuth, (req, res) => {
    if (Array.isArray(req.body.ids) && req.body.ids.length) {
      const ids = req.body.ids.map((x) => Number(x)).filter(Number.isInteger);
      db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`).run(now(), req.user.id, ...ids);
    } else db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), req.user.id);
    res.json({ unread: db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).c });
  });

  r.delete('/notifications/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(int(req.params.id, 'id', { min: 1 }), req.user.id);
    res.status(204).end();
  });

  r.delete('/notifications', requireAuth, (req, res) => {
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
    res.status(204).end();
  });

  // ---- Import ------------------------------------------------------------------------------
  r.post('/import/parse', requireAuth, (req, res) => {
    const format = oneOf(req.body.format, ['mal', 'watcharr'], 'format');
    const content = str(req.body.content, 'content', { max: 50_000_000, trim: false });
    const items = format === 'mal' ? parseMal(content) : parseWatcharr(content);
    res.json({ items });
  });

  r.post(
    '/import/item',
    requireAuth,
    wrap(async (req, res) => {
      const item = req.body.item;
      if (!item || typeof item !== 'object') throw err(400, 'item is required');
      try {
        let resolved = req.body.resolved && req.body.resolved.tmdb_id ? { type: req.body.resolved.type === 'movie' ? 'movie' : 'tv', tmdb_id: Number(req.body.resolved.tmdb_id) } : null;
        if (!resolved) resolved = await resolveItem(item);
        if (!resolved) return res.json({ result: 'not_found' });
        if (resolved.choices) return res.json({ result: 'choices', choices: resolved.choices });
        const out = await applyItem(db, req.user.id, item, resolved);
        res.json({ result: out.result, media: { id: out.media.id, title: out.media.title, media_type: out.media.media_type, tmdb_id: out.media.tmdb_id, poster_path: out.media.poster_path } });
      } catch (e) {
        if (e.status === 429) return res.json({ result: 'rate_limited', retry_after: e.retryAfter || 5 });
        if (e.status === 404) return res.json({ result: 'not_found' });
        throw e;
      }
    })
  );

  // ---- Admin --------------------------------------------------------------------------------
  const a = Router();
  a.use(requireAdmin);
  a.get('/overview', (req, res) => {
    const c = (sql) => db.prepare(sql).get().c;
    res.json({
      users: c('SELECT COUNT(*) AS c FROM users'),
      titles: c('SELECT COUNT(*) AS c FROM media'),
      tracked: c('SELECT COUNT(*) AS c FROM user_media'),
      events: c('SELECT COUNT(*) AS c FROM watch_events'),
      scheduler: scheduler ? scheduler.status() : null,
      legacy_import: parseJson(db.prepare("SELECT value FROM meta WHERE key = 'legacy_import'").get()?.value, null),
    });
  });
  a.get('/users', (req, res) => {
    const pg = pageOf(req.query, 25);
    const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const users = db
      .prepare(
        `SELECT u.id, u.username, u.email, u.is_admin, u.profile_privacy, u.created_at,
           (SELECT COUNT(*) FROM user_media um WHERE um.user_id = u.id) AS tracked,
           (SELECT MAX(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen
         FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(pg.limit, pg.offset)
      .map((u) => ({ ...u, is_admin: !!u.is_admin }));
    res.json({ users, total, page: pg.page, pages: Math.max(1, Math.ceil(total / pg.limit)) });
  });
  a.patch('/users/:id', (req, res) => {
    const id = int(req.params.id, 'id', { min: 1 });
    if (id === req.user.id && req.body.is_admin === false) throw err(400, 'You cannot demote yourself.');
    if (req.body.is_admin !== undefined) db.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?').run(req.body.is_admin ? 1 : 0, now(), id);
    res.json({ ok: true });
  });
  a.delete('/users/:id', (req, res) => {
    const id = int(req.params.id, 'id', { min: 1 });
    if (id === req.user.id) throw err(400, 'You cannot delete your own account from here.');
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (!info.changes) throw err(404, 'User not found.');
    res.status(204).end();
  });
  a.post(
    '/scheduler/run',
    wrap(async (req, res) => {
      if (!scheduler) throw err(503, 'Scheduler not available.');
      const out = await scheduler.tick({ force: req.body.force === true, limit: int(req.body.limit, 'limit', { min: 1, max: 500, optional: true }) });
      res.json(out);
    })
  );
  r.use('/admin', a);

  // ---- oEmbed -------------------------------------------------------------------------------
  r.get('/oembed', (req, res) => {
    const { url, format } = req.query;
    if (!url) throw err(400, 'url parameter is required');
    if (format && format !== 'json') throw err(501, 'Only JSON is supported');
    let u;
    try {
      u = new URL(String(url));
    } catch {
      throw err(400, 'Invalid URL');
    }
    const base = u.origin;
    const title = u.pathname.match(/^\/title\/(tv|movie)\/(\d+)\/?$/);
    const legacy = u.pathname.match(/^\/media\/(public\/)?(\d+)\/?$/);
    const profile = u.pathname.match(/^\/(u|profile)\/([^/]+)\/?$/);
    if (title || legacy) {
      const media = title
        ? db.prepare('SELECT * FROM media WHERE media_type = ? AND tmdb_id = ?').get(title[1], Number(title[2]))
        : legacy[1]
          ? db.prepare('SELECT * FROM media WHERE tmdb_id = ? ORDER BY id LIMIT 1').get(Number(legacy[2]))
          : db.prepare('SELECT * FROM media WHERE id = ?').get(Number(legacy[2]));
      if (!media) throw err(404, 'Not found');
      const year = media.release_date ? media.release_date.slice(0, 4) : '';
      return res.json({
        version: '1.0',
        type: 'link',
        provider_name: 'WatchRadar',
        provider_url: base,
        title: `${preferredTitle(media)}${year ? ` (${year})` : ''}`,
        author_name: media.media_type === 'tv' ? 'TV Series' : 'Movie',
        thumbnail_url: img(media.poster_path, 'w500') || undefined,
        thumbnail_width: media.poster_path ? 500 : undefined,
        thumbnail_height: media.poster_path ? 750 : undefined,
      });
    }
    if (profile) {
      const user = db.prepare('SELECT id, username, profile_privacy FROM users WHERE username = ?').get(profile[2]);
      if (!user || user.profile_privacy !== 'public') throw err(404, 'Not found');
      const completed = db.prepare(`SELECT COUNT(*) AS c FROM user_media WHERE user_id = ? AND (status = 'watched' OR watch_count > 0) AND is_private = 0`).get(user.id).c;
      return res.json({ version: '1.0', type: 'link', provider_name: 'WatchRadar', provider_url: base, title: `${user.username} on WatchRadar`, author_name: `${completed} titles completed`, thumbnail_url: `${base}/icon.png`, thumbnail_width: 512, thumbnail_height: 512 });
    }
    throw err(404, 'Not found');
  });

  return r;
}
