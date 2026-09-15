// Thin TMDB v3 client: fetch-based, small in-memory cache, explicit rate-limit signalling.
import { config } from '../config.js';

const BASE = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p';

export class TmdbError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const cache = new Map();
const TTL = 10 * 60_000;

function cached(key) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (hit) cache.delete(key);
  return undefined;
}
function remember(key, value, ttl = TTL) {
  if (cache.size > 2000) cache.clear();
  cache.set(key, { value, until: Date.now() + ttl });
}

export async function tmdb(path, params = {}, { ttl = TTL, fetchImpl = globalThis.fetch } = {}) {
  if (!config.tmdbApiKey) throw new TmdbError(503, 'TMDB_API_KEY is not configured on the server.');
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', config.tmdbApiKey);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const key = url.toString();
  const hit = cached(key);
  if (hit) return hit;
  const res = await fetchImpl(key, { headers: { accept: 'application/json' } });
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after')) || 5;
    throw new TmdbError(429, 'TMDB rate limit hit', retry);
  }
  if (res.status === 404) throw new TmdbError(404, 'Not found on TMDB');
  if (!res.ok) throw new TmdbError(502, `TMDB responded ${res.status}`);
  const data = await res.json();
  remember(key, data, ttl);
  return data;
}

export const api = {
  multiSearch: (query, page = 1) => tmdb('/search/multi', { query, page, include_adult: true }),
  searchTv: (query, page = 1) => tmdb('/search/tv', { query, page, include_adult: true }),
  searchMovie: (query, page = 1) => tmdb('/search/movie', { query, page, include_adult: true }),
  trending: (window = 'week') => tmdb(`/trending/all/${window}`, {}, { ttl: 60 * 60_000 }),
  details: (type, id) =>
    tmdb(`/${type}/${id}`, { append_to_response: 'alternative_titles,external_ids' }, { ttl: 5 * 60_000 }),
  season: (tvId, n) => tmdb(`/tv/${tvId}/season/${n}`, {}, { ttl: 5 * 60_000 }),
  find: (externalId, source) => tmdb(`/find/${externalId}`, { external_source: source }),
};

export const clearTmdbCache = () => cache.clear();
export const img = (path, size = 'w500') => (path ? `${IMG}/${size}${path}` : null);
