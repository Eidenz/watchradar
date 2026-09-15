// Cookie sessions (opaque random token, only its hash is stored) + password hashing.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { config } from '../config.js';
import { now } from '../db.js';
import { err } from './http.js';

export const COOKIE = 'wr_session';
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, h) => bcrypt.compare(pw, h);

export const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  is_admin: !!u.is_admin,
  profile_privacy: u.profile_privacy,
  title_language: u.title_language,
  auto_remove_from_lists: !!u.auto_remove_from_lists,
  auto_resume: !!u.auto_resume,
  created_at: u.created_at,
});

export function createSession(db, userId, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ts = now();
  const expires = new Date(Date.now() + config.sessionMs).toISOString();
  db.prepare(
    'INSERT INTO sessions (id, user_id, user_agent, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(hash(token), userId, String(req.get('user-agent') || '').slice(0, 300), ts, ts, expires);
  setCookie(res, token, req);
  return token;
}

function setCookie(res, token, req, clear = false) {
  res.append(
    'Set-Cookie',
    serializeCookie(COOKIE, clear ? '' : token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !!req.secure,
      path: '/',
      maxAge: clear ? 0 : Math.floor(config.sessionMs / 1000),
    })
  );
}

export function destroySession(db, req, res) {
  const token = readToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(hash(token));
  setCookie(res, '', req, true);
}

export function destroyAllSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function readToken(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const c = parseCookie(raw);
  return c[COOKIE] || null;
}

/** Soft auth: sets req.user when a valid session cookie is present, never fails. */
export function attachUser(db) {
  const find = db.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  );
  const touch = db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?');
  return (req, res, next) => {
    req.user = null;
    const token = readToken(req);
    if (!token) return next();
    const row = find.get(hash(token));
    if (!row) return next();
    if (row.expires_at < now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
      return next();
    }
    // Sliding expiry, touched at most once an hour.
    if (Date.now() - Date.parse(row.last_seen_at) > 3_600_000) {
      touch.run(now(), new Date(Date.now() + config.sessionMs).toISOString(), row.session_id);
    }
    const { session_id, expires_at, last_seen_at, ...user } = row;
    req.user = user;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(err(401, 'You need to be signed in.'));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(err(401, 'You need to be signed in.'));
  if (!req.user.is_admin) return next(err(403, 'Admin access required.'));
  next();
}

/** CSRF guard for cookie auth: state-changing API calls must carry our custom header. */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') === 'WatchRadar') return next();
  next(err(403, 'Missing request header.'));
}

/** Tiny in-memory rate limiter for auth endpoints (per IP, sliding window). */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'x';
    const t = Date.now();
    const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) return next(err(429, 'Too many attempts, slow down.'));
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    next();
  };
}
