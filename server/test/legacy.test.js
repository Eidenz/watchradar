import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { memDb } from './helpers.js';
import { importLegacy } from '../services/legacy.js';
import * as P from '../services/progress.js';

/** Build a tiny v1-shaped database in a temp file. */
function makeLegacy() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wr-legacy-')), 'old.sqlite3');
  const db = new Database(file);
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password_hash TEXT, created_at TEXT, updated_at TEXT, profile_privacy TEXT, preferred_title_language TEXT, is_admin INTEGER, auto_remove_from_lists_on_watched INTEGER);
    CREATE TABLE media (id INTEGER PRIMARY KEY, tmdb_id INTEGER, title TEXT, poster_path TEXT, backdrop_path TEXT, overview TEXT, release_date TEXT, number_of_seasons INTEGER, media_type TEXT, runtime INTEGER, genres TEXT, original_title TEXT, original_language TEXT, alternative_titles TEXT);
    CREATE TABLE user_media (id INTEGER PRIMARY KEY, user_id INTEGER, media_id INTEGER, status TEXT, rating INTEGER, is_rewatching INTEGER, watch_count INTEGER, created_at TEXT, updated_at TEXT, is_private INTEGER);
    CREATE TABLE user_episodes (id INTEGER PRIMARY KEY, user_id INTEGER, media_id INTEGER, season_number INTEGER, episode_number INTEGER, watch_count INTEGER, watched_at TEXT);
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, media_id INTEGER, tmdb_id INTEGER, season_number INTEGER, episode_number INTEGER, title TEXT, overview TEXT, air_date TEXT, runtime INTEGER);
    CREATE TABLE user_season_splits (id INTEGER PRIMARY KEY, user_id INTEGER, media_id INTEGER, original_season_number INTEGER, split_at_episode INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE user_lists (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, description TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE list_items (id INTEGER PRIMARY KEY, list_id INTEGER, media_id INTEGER, user_id INTEGER, item_order INTEGER, created_at TEXT);
    CREATE TABLE friends (id INTEGER PRIMARY KEY, user_one_id INTEGER, user_two_id INTEGER, status TEXT, action_user_id INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE user_activities (id INTEGER PRIMARY KEY, user_id INTEGER, media_id INTEGER, list_id INTEGER, type TEXT, details TEXT, is_private INTEGER, created_at TEXT);
    CREATE TABLE user_media_comments (id INTEGER PRIMARY KEY, user_id INTEGER, media_id INTEGER, comment TEXT, is_private INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO users VALUES (1, 'Eidenz', 'e@x.io', '$2b$10$hash', '2025-07-07 16:13:11', '2025-07-07 16:13:11', 'public', 'ja', 1, 0);
    INSERT INTO users VALUES (2, 'Friend', 'f@x.io', '$2b$10$hash2', '2025-07-08 16:13:11', '2025-07-08 16:13:11', 'private', 'en', 0, 1);
    INSERT INTO media VALUES (268, 100565, '86 EIGHTY-SIX', '/p.jpg', '/b.jpg', 'ov', '2021-04-11', 1, 'tv', 24, '[{"id":16,"name":"Animation"}]', '86', 'ja', NULL);
    INSERT INTO media VALUES (300, 550, 'Fight Club', '/f.jpg', NULL, 'ov', '1999-10-15', NULL, 'movie', 139, '[{"id":18,"name":"Drama"}]', 'Fight Club', 'en', NULL);
    INSERT INTO media VALUES (301, 1399, 'Game of Thrones', NULL, NULL, 'ov', '2011-04-17', 1, 'tv', 60, NULL, NULL, 'en', NULL);
    -- rewatching 86 (watch #2), rated 5 stars
    INSERT INTO user_media VALUES (1, 1, 268, 'watching', 5, 1, 2, '2025-07-07 22:13:55', '2025-07-07 22:53:12', 0);
    -- movie watched 3 times
    INSERT INTO user_media VALUES (2, 1, 300, 'watched', 4, 0, 3, '2025-07-07 23:22:36', '2025-07-07 23:22:36', 1);
    -- first-time watching GoT, 2 eps in
    INSERT INTO user_media VALUES (3, 1, 301, 'watching', NULL, 0, 0, '2025-07-09 10:00:00', '2025-07-09 10:00:00', 0);
    INSERT INTO user_media VALUES (4, 2, 300, 'to_watch', NULL, 0, 0, '2025-07-09 10:00:00', '2025-07-09 10:00:00', 0);
    INSERT INTO episodes (media_id, tmdb_id, season_number, episode_number, title, air_date, runtime) VALUES (268, 1, 1, 1, 'Undertaker', '2021-04-11', 23), (268, 2, 1, 2, 'Spearhead', '2021-04-18', 23), (268, 3, 1, 3, 'Third', '2021-04-25', 23);
    INSERT INTO episodes (media_id, tmdb_id, season_number, episode_number, title, air_date, runtime) VALUES (301, 4, 1, 1, 'Winter', '2011-04-17', 60), (301, 5, 1, 2, 'Kingsroad', '2011-04-24', 60), (301, 6, 1, 3, 'Lord Snow', '2011-05-01', 60);
    INSERT INTO user_episodes (user_id, media_id, season_number, episode_number, watch_count, watched_at) VALUES (1, 268, 1, 1, 1, '2025-07-07 22:14:03'), (1, 268, 1, 2, 1, '2025-07-07 22:14:03'), (1, 268, 1, 3, 1, '2025-07-07 22:14:03'), (1, 268, 1, 1, 2, '2025-07-07 22:53:12');
    INSERT INTO user_episodes (user_id, media_id, season_number, episode_number, watch_count, watched_at) VALUES (1, 301, 1, 1, 1, '2025-07-09 10:00:00'), (1, 301, 1, 2, 1, '2025-07-09 10:05:00');
    INSERT INTO user_season_splits VALUES (1, 1, 268, 1, 2, '2025-07-07 22:14:03', '2025-07-07 22:14:03');
    INSERT INTO user_lists VALUES (1, 1, 'test list', 'yodayo', '2025-07-08 22:58:01', '2025-07-08 22:58:01');
    INSERT INTO list_items VALUES (2, 1, 300, 1, 1, '2025-07-08 23:18:59');
    INSERT INTO friends VALUES (1, 1, 2, 'accepted', 2, '2025-07-25 10:00:00', '2025-07-25 10:00:00');
    INSERT INTO user_activities VALUES (1, 1, 300, NULL, 'RATED_MEDIA', '{"rating":4}', 0, '2025-07-07 23:22:36');
    INSERT INTO user_activities VALUES (2, 1, 268, NULL, 'STARTED_REWATCH', '{"watch_count":2}', 0, '2025-07-07 22:53:12');
    INSERT INTO user_media_comments VALUES (1, 1, 300, 'Great.', 0, '2025-07-28 10:00:00', '2025-07-28 10:00:00');
  `);
  db.close();
  return file;
}

test('legacy import maps runs, cuts, ratings, lists, friends and keeps ids', () => {
  const db = memDb();
  const report = importLegacy(db, makeLegacy(), { log: { info() {} } });
  assert.equal(report.users, 2);
  assert.equal(report.media, 3);
  assert.equal(report.tracking, 4);
  const u = db.prepare('SELECT * FROM users WHERE id = 1').get();
  assert.equal(u.username, 'Eidenz');
  assert.equal(u.title_language, 'ja');
  assert.equal(u.is_admin, 1);
  assert.equal(u.created_at, '2025-07-07T16:13:11.000Z');

  const show = db.prepare('SELECT * FROM media WHERE id = 268').get();
  assert.equal(show.tmdb_id, 100565);
  assert.equal(show.tmdb_synced_at, null, 'scheduler will resync');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM seasons WHERE media_id = 268').get().c, 1);

  // 86: was rewatching (#2) → run 1 complete, run 2 active with 1 episode.
  let t = P.getTracking(db, 1, 268);
  assert.equal(t.watch_count, 1);
  assert.equal(t.active_run, 2);
  assert.equal(t.status, 'watching');
  assert.equal(t.rating, 10);
  const p = P.showProgress(db, 1, show, t);
  assert.equal(p.is_rewatch, true);
  assert.equal(p.watched, 1);
  assert.equal(p.next_episode.code, 'S1E2');
  assert.equal(p.season.part_label, 'Part 1');
  assert.equal(P.getCuts(db, 1, 268)[0].after_episode, 2);

  // Movie watched 3 times, private.
  t = P.getTracking(db, 1, 300);
  assert.equal(t.watch_count, 3);
  assert.equal(t.is_private, 1);
  assert.equal(t.rating, 8);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM watch_events WHERE media_id = 300 AND run IS NOT NULL').get().c, 3);

  // GoT first watch in progress.
  t = P.getTracking(db, 1, 301);
  assert.equal(t.watch_count, 0);
  assert.equal(t.active_run, 1);
  const got = db.prepare('SELECT * FROM media WHERE id = 301').get();
  assert.equal(P.showProgress(db, 1, got, t).next_episode.code, 'S1E3');

  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM list_items WHERE list_id = 1').get().c, 1);
  assert.equal(db.prepare("SELECT status FROM friends WHERE id = 1").get().status, 'accepted');
  assert.equal(JSON.parse(db.prepare('SELECT details FROM activities WHERE id = 1').get().details).rating, 8);
  assert.equal(db.prepare('SELECT body FROM comments WHERE id = 1').get().body, 'Great.');
  assert.ok(db.prepare("SELECT value FROM meta WHERE key = 'legacy_import'").get());
  // 86 had run 1 with all 3 episodes already; nothing extra to fill.
  assert.equal(report.filled_events, 0);
});

test('legacy import of the real v1 dev database (if present)', { skip: !fs.existsSync('/home/eidenz/PROJECTS/WatchRadar/server/watchradar.sqlite3') }, () => {
  const db = memDb();
  const report = importLegacy(db, '/home/eidenz/PROJECTS/WatchRadar/server/watchradar.sqlite3', { log: { info() {} } });
  assert.equal(report.users, 1);
  assert.equal(report.media, 65);
  assert.equal(report.tracking, 65);
  assert.ok(report.watch_events >= 745);
  assert.ok(report.filled_events > 0, 'v1 completed-but-partial shows get their run filled');
  // No completed show is left with unwatched aired episodes.
  for (const t of db.prepare("SELECT um.*, m.* , um.id AS tid FROM user_media um JOIN media m ON m.id = um.media_id WHERE m.media_type = 'tv' AND um.status = 'watched'").all()) {
    const p = P.showProgress(db, t.user_id, { id: t.media_id, media_type: 'tv' }, t);
    assert.equal(p.unwatched_aired, 0, `${t.title} still has unwatched episodes`);
  }
  // Every tracked show has a consistent run state.
  for (const t of db.prepare('SELECT um.*, m.media_type FROM user_media um JOIN media m ON m.id = um.media_id').all()) {
    if (t.active_run) assert.ok(t.active_run > t.watch_count, `active run must be beyond completed runs for media ${t.media_id}`);
  }
});
