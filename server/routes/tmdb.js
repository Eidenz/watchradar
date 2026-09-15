import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { api } from '../lib/tmdb.js';
import { wrap, str, int } from '../lib/http.js';
import { searchResultView } from '../services/views.js';

export function tmdbRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  r.get(
    '/search',
    wrap(async (req, res) => {
      const q = str(req.query.q, 'q', { max: 200 });
      const page = int(req.query.page, 'page', { min: 1, max: 50, optional: true }) || 1;
      const type = req.query.type === 'tv' || req.query.type === 'movie' ? req.query.type : null;
      const data = type === 'tv' ? await api.searchTv(q, page) : type === 'movie' ? await api.searchMovie(q, page) : await api.multiSearch(q, page);
      const results = (data.results || [])
        .map((x) => (type ? { ...x, media_type: type } : x))
        .filter((x) => x.media_type === 'tv' || x.media_type === 'movie')
        .map((x) => searchResultView(db, req.user, x));
      res.json({ results, page: data.page || page, pages: Math.min(data.total_pages || 1, 50), total: data.total_results || results.length });
    })
  );

  r.get(
    '/trending',
    wrap(async (req, res) => {
      const data = await api.trending(req.query.window === 'day' ? 'day' : 'week');
      const results = (data.results || []).filter((x) => x.media_type === 'tv' || x.media_type === 'movie').map((x) => searchResultView(db, req.user, x));
      res.json({ results });
    })
  );

  return r;
}
