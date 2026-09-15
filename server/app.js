// Express app factory (kept separate from the listener so tests can spin one up in-memory).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { attachUser, csrfGuard } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import { TmdbError, img } from './lib/tmdb.js';
import { preferredTitle } from './lib/titles.js';
import { authRoutes } from './routes/auth.js';
import { tmdbRoutes } from './routes/tmdb.js';
import { titleRoutes } from './routes/titles.js';
import { libraryRoutes } from './routes/library.js';
import { listRoutes } from './routes/lists.js';
import { socialRoutes } from './routes/social.js';
import { miscRoutes } from './routes/misc.js';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createApp(db, { log = console, scheduler = null, distDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://image.tmdb.org'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // ---- API ---------------------------------------------------------------------------------
  const api = express.Router();
  api.use(express.json({ limit: '60mb' }));
  api.use(csrfGuard);
  api.use(attachUser(db));
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use('/auth', authRoutes(db));
  api.use('/tmdb', tmdbRoutes(db));
  api.use('/', titleRoutes(db));
  api.use('/library', libraryRoutes(db));
  api.use('/lists', listRoutes(db));
  api.use('/', socialRoutes(db));
  api.use('/', miscRoutes(db, { scheduler }));
  api.use((req, res) => res.status(404).json({ error: 'Not found' }));
  api.use((e, req, res, next) => {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, ...(e.retryAfter ? { retry_after: e.retryAfter } : {}) });
    if (e instanceof TmdbError) return res.status(e.status === 404 ? 404 : e.status === 429 ? 429 : 502).json({ error: e.message, retry_after: e.retryAfter });
    if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large.' });
    log.error(`${req.method} ${req.originalUrl} failed:`, e);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  app.use('/api', api);

  // ---- Old WatchRadar links keep working -------------------------------------------------------
  app.get('/media/public/:tmdbId(\\d+)', (req, res, next) => {
    const m = db.prepare('SELECT media_type, tmdb_id FROM media WHERE tmdb_id = ? ORDER BY id LIMIT 1').get(Number(req.params.tmdbId));
    if (!m) return next();
    res.redirect(301, `/title/${m.media_type}/${m.tmdb_id}`);
  });
  app.get('/media/:id(\\d+)', (req, res, next) => {
    const m = db.prepare('SELECT media_type, tmdb_id FROM media WHERE id = ?').get(Number(req.params.id));
    if (!m) return next();
    res.redirect(301, `/title/${m.media_type}/${m.tmdb_id}`);
  });
  app.get('/profile/:username', (req, res) => res.redirect(301, `/u/${encodeURIComponent(req.params.username)}`));
  app.get('/profile/:username/watched', (req, res) => res.redirect(301, `/u/${encodeURIComponent(req.params.username)}/library`));

  // ---- Static client + SSR meta tags --------------------------------------------------------------
  const dist = distDir ?? path.resolve(process.cwd(), 'client/dist');
  const indexFile = path.join(dist, 'index.html');
  if (fs.existsSync(indexFile)) {
    const readIndex = () => fs.readFileSync(indexFile, 'utf8');
    const origin = (req) => `${req.protocol}://${req.get('host')}`;
    const send = (res, html) => res.set('Content-Type', 'text/html').set('Cache-Control', 'no-cache').send(html);
    const withMeta = (req, { title, description, image, type = 'website', card = 'summary' }) => {
      const url = `${origin(req)}${req.originalUrl}`;
      const tags = [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}">`,
        `<meta property="og:site_name" content="WatchRadar">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        `<meta property="og:url" content="${escapeHtml(url)}">`,
        `<meta property="og:type" content="${type}">`,
        `<meta name="twitter:card" content="${card}">`,
        image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
        `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(`${origin(req)}/api/oembed?url=${encodeURIComponent(url)}&format=json`)}" title="${escapeHtml(title)}">`,
      ].join('\n');
      return readIndex().replace(/<title>[^<]*<\/title>/, '').replace('</head>', `${tags}\n</head>`);
    };

    app.get('/title/:type(tv|movie)/:tmdbId(\\d+)', (req, res, next) => {
      const m = db.prepare('SELECT * FROM media WHERE media_type = ? AND tmdb_id = ?').get(req.params.type, Number(req.params.tmdbId));
      if (!m) return next();
      const year = m.release_date ? ` (${m.release_date.slice(0, 4)})` : '';
      send(res, withMeta(req, {
        title: `${preferredTitle(m)}${year} · WatchRadar`,
        description: (m.overview || 'Track movies and series with WatchRadar.').slice(0, 200),
        image: img(m.poster_path, 'w500'),
        type: m.media_type === 'tv' ? 'video.tv_show' : 'video.movie',
        card: m.poster_path ? 'summary_large_image' : 'summary',
      }));
    });

    app.get('/u/:username', (req, res, next) => {
      const u = db.prepare('SELECT id, username, profile_privacy FROM users WHERE username = ?').get(req.params.username);
      if (!u || u.profile_privacy !== 'public') return next();
      const completed = db.prepare(`SELECT COUNT(*) AS c FROM user_media WHERE user_id = ? AND (status = 'watched' OR watch_count > 0) AND is_private = 0`).get(u.id).c;
      send(res, withMeta(req, { title: `${u.username} · WatchRadar`, description: `${u.username} has completed ${completed} titles on WatchRadar.`, image: `${origin(req)}/icon.png`, type: 'profile' }));
    });

    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, p) => p.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
    app.get(/^\/(?!api\/).*/, (req, res) => send(res, readIndex()));
  }

  app.use((e, req, res, next) => {
    log.error('unhandled', e);
    res.status(500).send('Server error');
  });
  return app;
}
