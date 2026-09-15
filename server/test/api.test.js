import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { memDb } from './helpers.js';
import { createApp } from '../app.js';
import { config } from '../config.js';
import { Scheduler } from '../services/scheduler.js';

// ---- Fake TMDB ------------------------------------------------------------------------------
const shows = {
  100: {
    id: 100, name: 'Radar Show', original_name: 'レーダー', original_language: 'ja', overview: 'A show.', poster_path: '/p.jpg', first_air_date: '2020-01-01',
    genres: [{ id: 16, name: 'Animation' }], episode_run_time: [24], status: 'Returning Series', in_production: true, number_of_seasons: 1, number_of_episodes: 2,
    seasons: [{ id: 1, season_number: 1, name: 'Season 1', episode_count: 2, air_date: '2020-01-01' }],
    alternative_titles: { results: [{ iso_3166_1: 'US', title: 'Radar Show US' }] },
  },
};
const seasonEpisodes = { '100:1': [
  { id: 11, season_number: 1, episode_number: 1, name: 'Pilot', air_date: '2020-01-01', runtime: 24 },
  { id: 12, season_number: 1, episode_number: 2, name: 'Second', air_date: '2020-01-08', runtime: 24 },
] };
const movies = { 500: { id: 500, title: 'Radar Movie', original_title: 'Radar Movie', original_language: 'en', overview: 'A movie.', release_date: '2019-05-05', runtime: 120, genres: [{ id: 28, name: 'Action' }], status: 'Released' } };

const json = (data, status = 200) => ({ ok: status < 400, status, headers: new Headers(), json: async () => data });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://api.themoviedb.org')) return realFetch(url, init);
  const u = new URL(url);
  const p = u.pathname.replace('/3', '');
  let m;
  if (p === '/search/multi') {
    const q = u.searchParams.get('query').toLowerCase();
    const results = [];
    if ('radar show'.includes(q)) results.push({ ...shows[100], media_type: 'tv' });
    if ('radar movie'.includes(q)) results.push({ ...movies[500], media_type: 'movie' });
    return json({ page: 1, total_pages: 1, total_results: results.length, results });
  }
  if ((m = p.match(/^\/tv\/(\d+)\/season\/(\d+)$/))) return json({ episodes: seasonEpisodes[`${m[1]}:${m[2]}`] || [] });
  if ((m = p.match(/^\/tv\/(\d+)$/))) return shows[m[1]] ? json(shows[m[1]]) : json({}, 404);
  if ((m = p.match(/^\/movie\/(\d+)$/))) return movies[m[1]] ? json(movies[m[1]]) : json({}, 404);
  if ((m = p.match(/^\/find\/(\d+)$/))) return json(m[1] === '777' ? { tv_results: [{ ...shows[100], media_type: 'tv' }], movie_results: [] } : { tv_results: [], movie_results: [] });
  if (p.startsWith('/trending')) return json({ results: [{ ...shows[100], media_type: 'tv' }] });
  return json({}, 404);
};
config.tmdbApiKey = 'test';

// ---- Client -----------------------------------------------------------------------------------
function client(base) {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-requested-with': 'WatchRadar', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
  return { call, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b), del: (p, b) => call('DELETE', p, b) };
}

async function boot() {
  const db = memDb();
  const scheduler = new Scheduler(db, { log: { info() {}, warn() {}, error() {} } });
  const app = createApp(db, { log: { error: () => {} }, scheduler, distDir: '/nonexistent' });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, scheduler, server, base, close: () => new Promise((r) => server.close(r)) };
}

test('auth: first user is admin, csrf header required, login by username or email', async (t) => {
  const s = await boot();
  t.after(s.close);
  const c = client(s.base);
  let r = await c.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.is_admin, true);
  r = await c.get('/api/auth/me');
  assert.equal(r.data.user.username, 'alice');
  // csrf: plain fetch without header
  const raw = await fetch(s.base + '/api/auth/logout', { method: 'POST' });
  assert.equal(raw.status, 403);
  r = await c.post('/api/auth/logout');
  assert.equal(r.status, 204);
  r = await c.get('/api/auth/me');
  assert.equal(r.status, 401);
  r = await c.post('/api/auth/login', { login: 'A@x.io', password: 'password1' });
  assert.equal(r.status, 200);
  r = await c.post('/api/auth/login', { login: 'alice', password: 'wrong' });
  assert.equal(r.status, 401);
  const bob = client(s.base);
  r = await bob.post('/api/auth/register', { username: 'bob', email: 'b@x.io', password: 'password1' });
  assert.equal(r.data.user.is_admin, false);
});

test('track a show through the API, mark episodes, home + library reflect it', async (t) => {
  const s = await boot();
  t.after(s.close);
  const c = client(s.base);
  await c.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  let r = await c.get('/api/tmdb/search?q=radar');
  assert.equal(r.status, 200);
  assert.equal(r.data.results.length, 2);
  assert.equal(r.data.results[0].tracking, null);

  r = await c.get('/api/titles/tv/100');
  assert.equal(r.status, 200);
  assert.equal(r.data.media.id, null, 'preview until tracked');
  assert.equal(r.data.media.preview_seasons.length, 1);

  r = await c.post('/api/titles/tv/100/track', { status: 'watching' });
  assert.equal(r.status, 201);
  const mediaId = r.data.media.id;
  assert.ok(mediaId);
  assert.equal(r.data.seasons.length, 1);
  assert.equal(r.data.seasons[0].episode_count, 2);
  assert.equal(r.data.progress.next_episode.code, 'S1E1');

  r = await c.post(`/api/media/${mediaId}/episodes`, { season: 1, episode: 1, watched: true });
  assert.equal(r.status, 200);
  assert.equal(r.data.progress.watched, 1);
  assert.equal(r.data.completed, false);

  r = await c.get('/api/library/home');
  assert.equal(r.data.continue_watching.length, 1);
  assert.equal(r.data.continue_watching[0].progress.next_episode.code, 'S1E2');

  r = await c.get(`/api/media/${mediaId}/seasons/1`);
  assert.equal(r.data.episodes[0].watched, true);
  assert.equal(r.data.episodes[1].watched, false);

  r = await c.patch(`/api/media/${mediaId}/rating`, { rating: 9 });
  assert.equal(r.data.tracking.rating, 9);
  r = await c.patch(`/api/media/${mediaId}/rating`, { rating: 11 });
  assert.equal(r.status, 400);

  r = await c.post(`/api/media/${mediaId}/episodes`, { season: 1, episode: 2 });
  assert.equal(r.data.completed, true);
  assert.equal(r.data.tracking.status, 'watched');

  r = await c.get('/api/library?status=watched');
  assert.equal(r.data.total, 1);
  assert.equal(r.data.counts.watched, 1);
  r = await c.get('/api/library?genre=Animation&search=レーダ');
  assert.equal(r.data.total, 1);
  r = await c.get('/api/library?genre=Horror');
  assert.equal(r.data.total, 0);

  r = await c.get('/api/stats');
  assert.equal(r.data.counts.completed_tv, 1);
  assert.equal(r.data.minutes.tv, 48);
  assert.equal(r.data.episodes_watched, 2);

  // Search now shows tracking.
  r = await c.get('/api/tmdb/search?q=radar%20show');
  assert.equal(r.data.results[0].tracking.status, 'watched');

  // Movie via list add auto-tracks.
  r = await c.post('/api/lists', { name: 'Faves' });
  const listId = r.data.id;
  r = await c.post(`/api/lists/${listId}/items`, { tmdb_id: 500, type: 'movie' });
  assert.equal(r.status, 201);
  assert.equal(r.data.item_count, 1);
  r = await c.get(`/api/lists/${listId}`);
  assert.equal(r.data.items[0].tracking.status, 'to_watch');
  r = await c.get('/api/library/export');
  assert.equal(r.data.titles.length, 2);
  assert.equal(r.data.lists[0].items.length, 1);
});

test('scheduler: new season fans out notifications and auto-resumes', async (t) => {
  const s = await boot();
  t.after(s.close);
  const c = client(s.base);
  await c.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  let r = await c.post('/api/titles/tv/100/track', { status: 'watched' });
  const mediaId = r.data.media.id;
  // TMDB grows a season.
  shows[100].seasons.push({ id: 2, season_number: 2, name: 'Season 2', episode_count: 1, air_date: '2021-01-01' });
  shows[100].number_of_seasons = 2;
  seasonEpisodes['100:2'] = [{ id: 21, season_number: 2, episode_number: 1, name: 'Return', air_date: '2021-01-01', runtime: 24 }];
  const { clearTmdbCache } = await import('../lib/tmdb.js');
  clearTmdbCache();
  const out = await s.scheduler.tick({ force: true });
  assert.equal(out.synced, 1);
  assert.equal(out.changed, 1);
  assert.equal(out.notifications, 1);
  assert.equal(out.resumed, 1);
  r = await c.get('/api/notifications');
  assert.equal(r.data.unread, 1);
  assert.equal(r.data.items[0].type, 'new_season');
  r = await c.get(`/api/media/${mediaId}`);
  assert.equal(r.data.tracking.status, 'watching');
  assert.equal(r.data.progress.next_episode.code, 'S2E1');
  r = await c.get('/api/auth/me');
  assert.equal(r.data.unread_notifications, 1);
  r = await c.post('/api/notifications/read', {});
  assert.equal(r.data.unread, 0);
  // Cleanup shared fixture.
  shows[100].seasons.pop();
  delete seasonEpisodes['100:2'];
});

test('friends + privacy + feed + public profile', async (t) => {
  const s = await boot();
  t.after(s.close);
  const a = client(s.base);
  const b = client(s.base);
  await a.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  await b.post('/api/auth/register', { username: 'bob', email: 'b@x.io', password: 'password1' });
  let r = await a.get('/api/users/bob');
  assert.equal(r.data.access, 'private');
  await b.patch('/api/auth/me', { profile_privacy: 'friends_only' });
  r = await a.get('/api/users/bob');
  assert.equal(r.data.access, 'friends_only');
  r = await a.post('/api/friends/request/2');
  assert.equal(r.data.status, 'pending_them');
  r = await b.get('/api/friends');
  assert.equal(r.data.incoming.length, 1);
  r = await b.post('/api/friends/accept/1');
  assert.equal(r.data.status, 'accepted');
  r = await a.get('/api/users/bob');
  assert.equal(r.data.access, 'public');
  assert.equal(r.data.friendship, 'accepted');

  await b.post('/api/titles/movie/500/track', { status: 'watched' });
  r = await a.get('/api/feed');
  assert.ok(r.data.items.some((i) => i.type === 'COMPLETED_MEDIA' && i.user.username === 'bob'));
  r = await b.get('/api/feed?scope=me');
  assert.ok(r.data.items.length >= 2);

  // Private title disappears from friend views.
  const mediaId = (await b.get('/api/titles/movie/500')).data.media.id;
  await b.patch(`/api/media/${mediaId}/privacy`, { is_private: true });
  r = await a.get('/api/feed');
  assert.equal(r.data.items.length, 0);
  r = await a.get('/api/users/bob/library');
  assert.equal(r.data.total, 0);
  r = await b.get('/api/users/bob/library');
  assert.equal(r.data.total, 1, 'owner still sees it');
  r = await a.get('/api/users/nobody');
  assert.equal(r.status, 404);
});

test('legacy redirects + oembed', async (t) => {
  const s = await boot();
  t.after(s.close);
  const c = client(s.base);
  await c.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  const r = await c.post('/api/titles/tv/100/track', {});
  const id = r.data.media.id;
  const red = await fetch(`${s.base}/media/${id}`, { redirect: 'manual' });
  assert.equal(red.status, 301);
  assert.equal(red.headers.get('location'), '/title/tv/100');
  const red2 = await fetch(`${s.base}/media/public/100`, { redirect: 'manual' });
  assert.equal(red2.headers.get('location'), '/title/tv/100');
  const oe = await (await fetch(`${s.base}/api/oembed?url=${encodeURIComponent(s.base + '/title/tv/100')}`)).json();
  assert.equal(oe.title, 'Radar Show (2020)');
});

test('import: MAL xml parses and applies statuses, episodes and rewatches', async (t) => {
  const s = await boot();
  t.after(s.close);
  const c = client(s.base);
  await c.post('/api/auth/register', { username: 'alice', email: 'a@x.io', password: 'password1' });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><myanimelist><myinfo><user_name>x</user_name></myinfo>
    <anime><series_animedb_id>777</series_animedb_id><series_title><![CDATA[Radar Show]]></series_title><series_type>TV</series_type><series_episodes>2</series_episodes>
      <my_watched_episodes>1</my_watched_episodes><my_score>8</my_score><my_status>Watching</my_status><my_times_watched>0</my_times_watched><my_rewatching>0</my_rewatching><my_start_date>2024-01-02</my_start_date><my_finish_date>0000-00-00</my_finish_date></anime>
    <anime><series_animedb_id>778</series_animedb_id><series_title><![CDATA[Radar Movie]]></series_title><series_type>Movie</series_type><series_episodes>1</series_episodes>
      <my_watched_episodes>1</my_watched_episodes><my_score>10</my_score><my_status>Completed</my_status><my_times_watched>2</my_times_watched><my_rewatching>0</my_rewatching><my_start_date>0000-00-00</my_start_date><my_finish_date>2024-03-03</my_finish_date></anime>
    <anime><series_animedb_id>779</series_animedb_id><series_title><![CDATA[Nothing Like This]]></series_title><series_type>TV</series_type><series_episodes>12</series_episodes>
      <my_watched_episodes>0</my_watched_episodes><my_score>0</my_score><my_status>Plan to Watch</my_status><my_times_watched>0</my_times_watched><my_rewatching>0</my_rewatching></anime>
  </myanimelist>`;
  let r = await c.post('/api/import/parse', { format: 'mal', content: xml });
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 3);
  assert.equal(r.data.items[0].status, 'watching');
  assert.equal(r.data.items[0].external_id, 777);
  assert.equal(r.data.items[1].rating, 10);
  // Show resolves via MAL id → tv 100; 1 episode watched, rating 8.
  r = await c.post('/api/import/item', { item: r.data.items[0] });
  assert.equal(r.data.result, 'imported');
  const show = await c.get('/api/titles/tv/100');
  assert.equal(show.data.tracking.status, 'watching');
  assert.equal(show.data.tracking.rating, 8);
  assert.equal(show.data.progress.watched, 1);
  assert.equal(show.data.progress.next_episode.code, 'S1E2');
  assert.equal(show.data.tracking.started_at.slice(0, 10), '2024-01-02');
  // Movie resolves by exact name; completed + 2 rewatches = 3 viewings.
  const items = (await c.post('/api/import/parse', { format: 'mal', content: xml })).data.items;
  r = await c.post('/api/import/item', { item: items[1] });
  assert.equal(r.data.result, 'imported');
  const movie = await c.get('/api/titles/movie/500');
  assert.equal(movie.data.tracking.status, 'watched');
  assert.equal(movie.data.tracking.watch_count, 3);
  assert.equal(movie.data.tracking.rating, 10);
  // Unknown title → not found. Re-importing → exists.
  r = await c.post('/api/import/item', { item: items[2] });
  assert.equal(r.data.result, 'not_found');
  r = await c.post('/api/import/item', { item: items[0] });
  assert.equal(r.data.result, 'exists');
  // Watcharr shape.
  const wj = JSON.stringify([{ status: 'FINISHED', rating: 7, content: { tmdbId: 500, title: 'Radar Movie', type: 'movie' } }, { status: 'WATCHING', content: { tmdbId: 100, title: 'Radar Show', type: 'show' }, watchedEpisodes: [{ seasonNumber: 1, episodeNumber: 1, createdAt: '2024-05-05T10:00:00Z' }] }]);
  r = await c.post('/api/import/parse', { format: 'watcharr', content: wj });
  assert.equal(r.data.items[0].tmdb_id, 500);
  assert.equal(r.data.items[1].type, 'tv');
  assert.equal(r.data.items[1].watched_episodes_list.length, 1);
});
