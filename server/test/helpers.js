import { openDb, now } from '../db.js';

/** Seed a TV show with N seasons × M episodes (all aired unless airDate given) and a user. */
export function seedShow(db, { seasons = 2, episodes = 3, aired = true, tmdbId = 100 } = {}) {
  const ts = now();
  const info = db
    .prepare(`INSERT INTO media (tmdb_id, media_type, title, release_date, runtime, genres, created_at) VALUES (?, 'tv', ?, '2020-01-01', 24, '[{"id":16,"name":"Animation"}]', ?)`)
    .run(tmdbId, `Show ${tmdbId}`, ts);
  const mediaId = Number(info.lastInsertRowid);
  for (let s = 1; s <= seasons; s++) {
    db.prepare('INSERT INTO seasons (media_id, season_number, name, episode_count) VALUES (?, ?, ?, ?)').run(mediaId, s, `Season ${s}`, episodes);
    for (let e = 1; e <= episodes; e++) {
      db.prepare('INSERT INTO episodes (media_id, season_number, episode_number, title, air_date, runtime) VALUES (?, ?, ?, ?, ?, 24)').run(
        mediaId,
        s,
        e,
        `S${s}E${e}`,
        aired ? '2020-01-01' : '2999-01-01'
      );
    }
  }
  return db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
}

export function seedMovie(db, { tmdbId = 500 } = {}) {
  const info = db
    .prepare(`INSERT INTO media (tmdb_id, media_type, title, release_date, runtime, genres, created_at) VALUES (?, 'movie', ?, '2019-05-05', 120, '[{"id":28,"name":"Action"}]', ?)`)
    .run(tmdbId, `Movie ${tmdbId}`, now());
  return db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
}

export function seedUser(db, name = 'alice') {
  const ts = now();
  const info = db.prepare('INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(name, `${name}@x.io`, 'x', ts, ts);
  return Number(info.lastInsertRowid);
}

export const memDb = () => openDb(':memory:');
