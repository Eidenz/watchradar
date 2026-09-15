import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

const SCHEMA_VERSION = 1;

export function openDb(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });
  if (version >= SCHEMA_VERSION) return;
  db.transaction(() => {
    if (version < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id                    INTEGER PRIMARY KEY,
          username              TEXT NOT NULL COLLATE NOCASE UNIQUE,
          email                 TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash         TEXT NOT NULL,
          is_admin              INTEGER NOT NULL DEFAULT 0,
          profile_privacy       TEXT NOT NULL DEFAULT 'private',
          title_language        TEXT NOT NULL DEFAULT 'en',
          auto_remove_from_lists INTEGER NOT NULL DEFAULT 0,
          auto_resume           INTEGER NOT NULL DEFAULT 1,
          created_at            TEXT NOT NULL,
          updated_at            TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id           TEXT PRIMARY KEY,
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_agent   TEXT,
          created_at   TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          expires_at   TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

        CREATE TABLE IF NOT EXISTS media (
          id                 INTEGER PRIMARY KEY,
          tmdb_id            INTEGER NOT NULL,
          media_type         TEXT NOT NULL,
          title              TEXT NOT NULL,
          original_title     TEXT,
          original_language  TEXT,
          alternative_titles TEXT,
          overview           TEXT,
          poster_path        TEXT,
          backdrop_path      TEXT,
          release_date       TEXT,
          runtime            INTEGER,
          genres             TEXT,
          tmdb_status        TEXT,
          in_production      INTEGER NOT NULL DEFAULT 0,
          number_of_seasons  INTEGER,
          number_of_episodes INTEGER,
          next_air_date      TEXT,
          last_air_date      TEXT,
          vote_average       REAL,
          tmdb_synced_at     TEXT,
          created_at         TEXT NOT NULL,
          UNIQUE(media_type, tmdb_id)
        );
        CREATE TABLE IF NOT EXISTS seasons (
          id             INTEGER PRIMARY KEY,
          media_id       INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          season_number  INTEGER NOT NULL,
          tmdb_id        INTEGER,
          name           TEXT,
          overview       TEXT,
          poster_path    TEXT,
          air_date       TEXT,
          episode_count  INTEGER NOT NULL DEFAULT 0,
          UNIQUE(media_id, season_number)
        );
        CREATE TABLE IF NOT EXISTS episodes (
          id             INTEGER PRIMARY KEY,
          media_id       INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          season_number  INTEGER NOT NULL,
          episode_number INTEGER NOT NULL,
          tmdb_id        INTEGER,
          title          TEXT,
          overview       TEXT,
          air_date       TEXT,
          runtime        INTEGER,
          still_path     TEXT,
          UNIQUE(media_id, season_number, episode_number)
        );

        CREATE TABLE IF NOT EXISTS user_media (
          id           INTEGER PRIMARY KEY,
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id     INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          status       TEXT NOT NULL DEFAULT 'to_watch',
          rating       INTEGER,
          is_private   INTEGER NOT NULL DEFAULT 0,
          watch_count  INTEGER NOT NULL DEFAULT 0,
          active_run   INTEGER,
          notes        TEXT,
          started_at   TEXT,
          completed_at TEXT,
          created_at   TEXT NOT NULL,
          updated_at   TEXT NOT NULL,
          UNIQUE(user_id, media_id)
        );
        CREATE INDEX IF NOT EXISTS user_media_status ON user_media(user_id, status);
        CREATE INDEX IF NOT EXISTS user_media_media ON user_media(media_id);

        -- One row per viewing. run = which full play-through of the title it belongs to
        -- (NULL = a one-off rewatch of a single episode that is not part of a run).
        CREATE TABLE IF NOT EXISTS watch_events (
          id             INTEGER PRIMARY KEY,
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id       INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          season_number  INTEGER,
          episode_number INTEGER,
          run            INTEGER,
          watched_at     TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS watch_events_run
          ON watch_events(user_id, media_id, season_number, episode_number, run) WHERE run IS NOT NULL;
        CREATE INDEX IF NOT EXISTS watch_events_lookup ON watch_events(user_id, media_id, season_number, episode_number);
        CREATE INDEX IF NOT EXISTS watch_events_time ON watch_events(user_id, watched_at);

        CREATE TABLE IF NOT EXISTS season_cuts (
          id             INTEGER PRIMARY KEY,
          user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id       INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          season_number  INTEGER NOT NULL,
          after_episode  INTEGER NOT NULL,
          created_at     TEXT NOT NULL,
          UNIQUE(user_id, media_id, season_number, after_episode)
        );

        CREATE TABLE IF NOT EXISTS lists (
          id          INTEGER PRIMARY KEY,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          description TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS list_items (
          id        INTEGER PRIMARY KEY,
          list_id   INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
          media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          position  INTEGER NOT NULL DEFAULT 0,
          added_at  TEXT NOT NULL,
          UNIQUE(list_id, media_id)
        );

        CREATE TABLE IF NOT EXISTS friends (
          id             INTEGER PRIMARY KEY,
          user_one_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_two_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status         TEXT NOT NULL DEFAULT 'pending',
          action_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at     TEXT NOT NULL,
          updated_at     TEXT NOT NULL,
          UNIQUE(user_one_id, user_two_id)
        );

        CREATE TABLE IF NOT EXISTS activities (
          id         INTEGER PRIMARY KEY,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id   INTEGER REFERENCES media(id) ON DELETE CASCADE,
          list_id    INTEGER REFERENCES lists(id) ON DELETE CASCADE,
          type       TEXT NOT NULL,
          details    TEXT,
          is_private INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activities_user_time ON activities(user_id, created_at);

        CREATE TABLE IF NOT EXISTS comments (
          id         INTEGER PRIMARY KEY,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
          body       TEXT NOT NULL,
          is_private INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, media_id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id         INTEGER PRIMARY KEY,
          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_id   INTEGER REFERENCES media(id) ON DELETE CASCADE,
          type       TEXT NOT NULL,
          payload    TEXT,
          read_at    TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, read_at, created_at);

        CREATE TABLE IF NOT EXISTS meta (
          key   TEXT PRIMARY KEY,
          value TEXT
        );
      `);
    }
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}

export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
