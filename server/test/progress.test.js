import test from 'node:test';
import assert from 'node:assert/strict';
import { memDb, seedShow, seedMovie, seedUser } from './helpers.js';
import * as P from '../services/progress.js';

test('first watch: episodes accumulate in run 1 and complete the show', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 3 });
  P.track(db, u, show, { status: 'watching' });
  let t = P.getTracking(db, u, show.id);
  assert.equal(t.active_run, 1);
  P.setEpisodeWatched(db, u, show, 1, 1, true);
  P.setEpisodeWatched(db, u, show, 1, 2, true);
  let p = P.showProgress(db, u, show, P.getTracking(db, u, show.id));
  assert.equal(p.watched, 2);
  assert.equal(p.next_episode.code, 'S1E3');
  const out = P.setEpisodeWatched(db, u, show, 1, 3, true);
  assert.equal(out.completed, true);
  t = P.getTracking(db, u, show.id);
  assert.equal(t.status, 'watched');
  assert.equal(t.watch_count, 1);
  assert.equal(t.active_run, null);
  const types = db.prepare('SELECT type FROM activities WHERE user_id = ? ORDER BY id').all(u).map((r) => r.type);
  assert.deepEqual(types, ['TRACKED_MEDIA', 'WATCHED_EPISODE', 'WATCHED_EPISODE', 'COMPLETED_MEDIA']);
});

test('rewatch opens run 2 without touching run 1; cancelling wipes only run 2', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  assert.equal(P.getTracking(db, u, show.id).watch_count, 1);
  P.startRewatch(db, u, show);
  let t = P.getTracking(db, u, show.id);
  assert.equal(t.active_run, 2);
  assert.equal(t.status, 'watching');
  P.setEpisodeWatched(db, u, show, 1, 1, true);
  const eps = P.episodesWithState(db, u, show, P.getTracking(db, u, show.id), 1);
  assert.equal(eps[0].watched, true);
  assert.equal(eps[0].play_count, 2);
  assert.equal(eps[1].watched, false);
  assert.equal(eps[1].play_count, 1);
  P.cancelRewatch(db, u, show);
  t = P.getTracking(db, u, show.id);
  assert.equal(t.active_run, null);
  assert.equal(t.status, 'watched');
  assert.equal(t.watch_count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM watch_events WHERE user_id = ? AND run = 1').get(u).c, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM watch_events WHERE user_id = ? AND run = 2').get(u).c, 0);
});

test('one-off episode rewatch does not affect the run', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  assert.equal(P.rewatchEpisode(db, u, show, 1, 2), 2);
  assert.equal(P.rewatchEpisode(db, u, show, 1, 2), 3);
  assert.equal(P.getTracking(db, u, show.id).watch_count, 1);
  assert.equal(P.undoRewatchEpisode(db, u, show, 1, 2), 2);
  P.startRewatch(db, u, show);
  const eps = P.episodesWithState(db, u, show, P.getTracking(db, u, show.id), 1);
  assert.equal(eps[1].watched, false, 'one-off rewatch is not part of run 2');
});

test('new episodes on a completed show reopen the same run, not a rewatch', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  // A new season airs.
  db.prepare("INSERT INTO seasons (media_id, season_number, name, episode_count) VALUES (?, 2, 'Season 2', 1)").run(show.id);
  db.prepare("INSERT INTO episodes (media_id, season_number, episode_number, title, air_date) VALUES (?, 2, 1, 'S2E1', '2021-01-01')").run(show.id);
  let p = P.showProgress(db, u, show, P.getTracking(db, u, show.id));
  assert.equal(p.unwatched_aired, 1);
  assert.equal(p.complete, false);
  const resumed = P.autoResume(db, show);
  assert.deepEqual(resumed, [u]);
  let t = P.getTracking(db, u, show.id);
  assert.equal(t.status, 'watching');
  assert.equal(t.active_run, 1);
  const out = P.setEpisodeWatched(db, u, show, 2, 1, true);
  assert.equal(out.completed, true);
  t = P.getTracking(db, u, show.id);
  assert.equal(t.watch_count, 1, 'still one completed run');
  assert.equal(t.status, 'watched');
  // Not logged as a second completion.
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM activities WHERE type IN ('COMPLETED_MEDIA','COMPLETED_REWATCH')").get().c, 1);
});

test('setting status to watching on a fully completed show starts a rewatch', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  P.setStatus(db, u, show, 'watching');
  const t = P.getTracking(db, u, show.id);
  assert.equal(t.active_run, 2);
  assert.equal(t.watch_count, 1);
});

test('unwatching an episode of a completed run reopens it', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  P.setEpisodeWatched(db, u, show, 1, 2, false);
  const t = P.getTracking(db, u, show.id);
  assert.equal(t.status, 'watching');
  assert.equal(t.active_run, 1);
  assert.equal(t.watch_count, 0);
});

test('unaired episodes never block completion and show as upcoming', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  db.prepare("INSERT INTO episodes (media_id, season_number, episode_number, title, air_date) VALUES (?, 1, 3, 'S1E3', '2999-01-01')").run(show.id);
  P.track(db, u, show, { status: 'watching' });
  P.markUpTo(db, u, show, { season: 1, episode: 2 });
  const t = P.getTracking(db, u, show.id);
  assert.equal(t.status, 'watched');
  const p = P.showProgress(db, u, show, t);
  assert.equal(p.upcoming.code, 'S1E3');
  assert.equal(p.next_episode, null);
});

test('season cuts split progress into parts and survive a refresh', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 24 });
  P.track(db, u, show, { status: 'watching' });
  P.addCut(db, u, show, 1, 12);
  assert.throws(() => P.addCut(db, u, show, 1, 24));
  P.markUpTo(db, u, show, { season: 1, episode: 14 });
  const p = P.showProgress(db, u, show, P.getTracking(db, u, show.id));
  assert.equal(p.season.part_label, 'Part 2');
  assert.equal(p.season.watched, 2);
  assert.equal(p.season.total, 12);
  assert.equal(p.next_episode.display_number, 3);
  const eps = P.episodesWithState(db, u, show, P.getTracking(db, u, show.id), 1);
  assert.equal(eps[12].display_number, 1);
  assert.equal(eps[12].part_label, 'Part 2');
  assert.deepEqual(P.seasonParts(10, [3, 7]).map((x) => [x.start, x.end]), [[1, 3], [4, 7], [8, 10]]);
  assert.equal(P.getCuts(db, u, show.id).length, 1);
});

test('movies: watched = one run, watching again = another', () => {
  const db = memDb();
  const u = seedUser(db);
  const movie = seedMovie(db);
  P.track(db, u, movie, { status: 'watched' });
  let t = P.getTracking(db, u, movie.id);
  assert.equal(t.watch_count, 1);
  P.startRewatch(db, u, movie);
  t = P.getTracking(db, u, movie.id);
  assert.equal(t.watch_count, 2);
  const h = P.history(db, u, movie.id);
  assert.equal(h.length, 2);
  P.deleteEvent(db, u, movie, h[0].id);
  assert.equal(P.getTracking(db, u, movie.id).watch_count, 1);
});

test('untrack removes every trace', () => {
  const db = memDb();
  const u = seedUser(db);
  const show = seedShow(db, { seasons: 1, episodes: 2 });
  P.track(db, u, show, { status: 'watched' });
  P.addCut(db, u, show, 1, 1);
  P.untrack(db, u, show.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM watch_events').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM season_cuts').get().c, 0);
  assert.equal(P.getTracking(db, u, show.id), undefined);
});
