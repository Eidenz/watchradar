// Runtime configuration. Everything is overridable via environment variables so the same
// image runs from docker-compose, behind a reverse proxy, or straight from `npm start`.
import path from 'node:path';

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

const dataDir = path.resolve(process.env.DATA_DIR || './data');

export const config = {
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  dataDir,
  dbFile: process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(dataDir, 'watchradar.db'),
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  /** `true` when behind nginx/caddy/traefik so req.ip / req.secure reflect the real client. */
  trustProxy: bool(process.env.TRUST_PROXY, false),
  allowRegistration: bool(process.env.ALLOW_REGISTRATION, true),
  sessionMs: num(process.env.SESSION_DAYS, 90) * 86_400_000,
  /** Background TMDB sync cadence and per-tick budget. */
  refreshIntervalMs: num(process.env.REFRESH_INTERVAL_MINUTES, 360) * 60_000,
  refreshBatch: num(process.env.REFRESH_BATCH, 40),
  /** Old WatchRadar (v1) sqlite file to import on first boot when the new DB is empty. */
  legacyDb: process.env.LEGACY_DB ? path.resolve(process.env.LEGACY_DB) : '',
  isProd: process.env.NODE_ENV === 'production',
};

export const STATUSES = ['watching', 'to_watch', 'watched', 'on_hold', 'dropped'];
export const PRIVACY = ['public', 'friends_only', 'users_only', 'private'];
export const TITLE_LANGUAGES = ['en', 'original', 'ja'];
export const MEDIA_TYPES = ['tv', 'movie'];
