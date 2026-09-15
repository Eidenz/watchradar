import { Router } from 'express';
import { config, PRIVACY, TITLE_LANGUAGES } from '../config.js';
import { now } from '../db.js';
import { createSession, destroySession, destroyAllSessions, hashPassword, verifyPassword, publicUser, rateLimit, requireAuth } from '../lib/auth.js';
import { err, wrap, str, oneOf } from '../lib/http.js';

const USERNAME = /^[A-Za-z0-9_.-]{2,32}$/;

export function authRoutes(db) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 15 * 60_000, max: 40 });

  const meView = (user) => {
    const unread = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id).c;
    const requests = db
      .prepare(`SELECT COUNT(*) AS c FROM friends WHERE status = 'pending' AND action_user_id != ? AND (user_one_id = ? OR user_two_id = ?)`)
      .get(user.id, user.id, user.id).c;
    return { user: publicUser(user), unread_notifications: unread, pending_requests: requests, registration_open: config.allowRegistration };
  };

  r.get('/config', (req, res) => {
    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    res.json({ registration_open: config.allowRegistration || users === 0, first_run: users === 0, tmdb_configured: !!config.tmdbApiKey });
  });

  r.post(
    '/register',
    limiter,
    wrap(async (req, res) => {
      const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      if (!config.allowRegistration && users > 0) throw err(403, 'Registration is closed on this server.');
      const username = str(req.body.username, 'username', { max: 32 });
      if (!USERNAME.test(username)) throw err(400, 'Username: 2–32 letters, digits, dots, dashes or underscores.');
      const email = str(req.body.email, 'email', { max: 200 }).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(400, 'That email address does not look right.');
      const password = str(req.body.password, 'password', { max: 200, trim: false });
      if (password.length < 8) throw err(400, 'Password must be at least 8 characters.');
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw err(409, 'That username is taken.');
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw err(409, 'That email is already registered.');
      const ts = now();
      const info = db
        .prepare('INSERT INTO users (username, email, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(username, email, await hashPassword(password), users === 0 ? 1 : 0, ts, ts);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      createSession(db, user.id, req, res);
      res.status(201).json(meView(user));
    })
  );

  r.post(
    '/login',
    limiter,
    wrap(async (req, res) => {
      const login = str(req.body.login ?? req.body.email ?? req.body.username, 'login', { max: 200 });
      const password = str(req.body.password, 'password', { max: 200, trim: false });
      const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(login.toLowerCase(), login);
      if (!user || !(await verifyPassword(password, user.password_hash))) throw err(401, 'Wrong username/email or password.');
      createSession(db, user.id, req, res);
      res.json(meView(user));
    })
  );

  r.post('/logout', (req, res) => {
    destroySession(db, req, res);
    res.status(204).end();
  });

  r.post('/logout-all', requireAuth, (req, res) => {
    destroyAllSessions(db, req.user.id);
    destroySession(db, req, res);
    res.status(204).end();
  });

  r.get('/me', requireAuth, (req, res) => res.json(meView(req.user)));

  r.patch('/me', requireAuth, (req, res) => {
    const u = {};
    if (req.body.profile_privacy !== undefined) u.profile_privacy = oneOf(req.body.profile_privacy, PRIVACY, 'profile_privacy');
    if (req.body.title_language !== undefined) u.title_language = oneOf(req.body.title_language, TITLE_LANGUAGES, 'title_language');
    if (req.body.auto_remove_from_lists !== undefined) u.auto_remove_from_lists = req.body.auto_remove_from_lists ? 1 : 0;
    if (req.body.auto_resume !== undefined) u.auto_resume = req.body.auto_resume ? 1 : 0;
    if (req.body.email !== undefined) {
      const email = str(req.body.email, 'email', { max: 200 }).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(400, 'That email address does not look right.');
      const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
      if (clash) throw err(409, 'That email is already registered.');
      u.email = email;
    }
    const cols = Object.keys(u);
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @updated_at WHERE id = @id`).run({ ...u, updated_at: now(), id: req.user.id });
    }
    res.json(meView(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
  });

  r.post(
    '/password',
    requireAuth,
    wrap(async (req, res) => {
      const current = str(req.body.current, 'current password', { max: 200, trim: false });
      const next = str(req.body.next, 'new password', { max: 200, trim: false });
      if (next.length < 8) throw err(400, 'New password must be at least 8 characters.');
      if (!(await verifyPassword(current, req.user.password_hash))) throw err(401, 'Current password is wrong.');
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(await hashPassword(next), now(), req.user.id);
      res.json({ ok: true });
    })
  );

  r.delete(
    '/me',
    requireAuth,
    wrap(async (req, res) => {
      const password = str(req.body.password, 'password', { max: 200, trim: false });
      if (!(await verifyPassword(password, req.user.password_hash))) throw err(401, 'Password is wrong.');
      db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
      destroySession(db, req, res);
      res.status(204).end();
    })
  );

  return r;
}
