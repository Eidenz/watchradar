// One-shot import of an old WatchRadar (v1, knex/sqlite3) database into the new schema.
// Ids are preserved so old share links (/media/:id, /profile/:username) keep resolving.
import Database from 'better-sqlite3';
import { now } from '../db.js';

const iso = (v) => {
  if (!v) return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z').toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const hasTable = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const cols = (db, table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));

export function isEmpty(db) {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
}

export function importLegacy(db, legacyFile, { log = console } = {}) {
  const old = new Database(legacyFile, { readonly: true, fileMustExist: true });
  const report = {};
  const ts = now();
  try {
    if (!hasTable(old, 'users') || !hasTable(old, 'media')) throw new Error('This does not look like a WatchRadar v1 database.');
    const userCols = cols(old, 'users');
    const umCols = cols(old, 'user_media');
    const mediaCols = cols(old, 'media');

    db.transaction(() => {
      // Users
      const users = old.prepare('SELECT * FROM users').all();
      const insUser = db.prepare(
        `INSERT INTO users (id, username, email, password_hash, is_admin, profile_privacy, title_language, auto_remove_from_lists, auto_resume, created_at, updated_at)
         VALUES (@id, @username, @email, @password_hash, @is_admin, @profile_privacy, @title_language, @auto_remove, 1, @created_at, @updated_at)`
      );
      for (const u of users) {
        insUser.run({
          id: u.id,
          username: u.username,
          email: u.email,
          password_hash: u.password_hash,
          is_admin: userCols.has('is_admin') ? (u.is_admin ? 1 : 0) : 0,
          profile_privacy: userCols.has('profile_privacy') ? u.profile_privacy || 'private' : 'private',
          title_language: userCols.has('preferred_title_language') ? u.preferred_title_language || 'en' : 'en',
          auto_remove: userCols.has('auto_remove_from_lists_on_watched') ? (u.auto_remove_from_lists_on_watched ? 1 : 0) : 0,
          created_at: iso(u.created_at) || ts,
          updated_at: iso(u.updated_at) || ts,
        });
      }
      report.users = users.length;

      // Media
      const media = old.prepare('SELECT * FROM media').all();
      const insMedia = db.prepare(
        `INSERT INTO media (id, tmdb_id, media_type, title, original_title, original_language, alternative_titles, overview, poster_path, backdrop_path,
           release_date, runtime, genres, number_of_seasons, tmdb_synced_at, created_at)
         VALUES (@id, @tmdb_id, @media_type, @title, @original_title, @original_language, @alternative_titles, @overview, @poster_path, @backdrop_path,
           @release_date, @runtime, @genres, @number_of_seasons, NULL, @created_at)`
      );
      for (const m of media) {
        insMedia.run({
          id: m.id,
          tmdb_id: m.tmdb_id,
          media_type: m.media_type || 'tv',
          title: m.title || 'Untitled',
          original_title: mediaCols.has('original_title') ? m.original_title : null,
          original_language: mediaCols.has('original_language') ? m.original_language : null,
          alternative_titles: mediaCols.has('alternative_titles') ? m.alternative_titles : null,
          overview: m.overview,
          poster_path: m.poster_path,
          backdrop_path: m.backdrop_path,
          release_date: m.release_date,
          runtime: mediaCols.has('runtime') ? m.runtime : null,
          genres: mediaCols.has('genres') ? m.genres : null,
          number_of_seasons: m.number_of_seasons,
          created_at: ts,
        });
      }
      report.media = media.length;

      // Episodes (+ derived seasons)
      let episodes = [];
      if (hasTable(old, 'episodes')) {
        episodes = old.prepare('SELECT * FROM episodes').all();
        const epCols = cols(old, 'episodes');
        const insEp = db.prepare(
          `INSERT OR IGNORE INTO episodes (media_id, season_number, episode_number, tmdb_id, title, overview, air_date, runtime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const e of episodes) insEp.run(e.media_id, e.season_number, e.episode_number, e.tmdb_id, e.title, e.overview, e.air_date, epCols.has('runtime') ? e.runtime : null);
        const insSeason = db.prepare(
          `INSERT OR IGNORE INTO seasons (media_id, season_number, name, air_date, episode_count) VALUES (?, ?, ?, ?, ?)`
        );
        for (const s of db.prepare('SELECT media_id, season_number, COUNT(*) AS c, MIN(air_date) AS air FROM episodes GROUP BY media_id, season_number').all()) {
          insSeason.run(s.media_id, s.season_number, s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`, s.air, s.c);
        }
      }
      report.episodes = episodes.length;

      // Tracking
      const um = old.prepare('SELECT * FROM user_media').all();
      const oldEpisodes = hasTable(old, 'user_episodes') ? old.prepare('SELECT * FROM user_episodes').all() : [];
      const runsByPair = new Map();
      for (const e of oldEpisodes) {
        const k = `${e.user_id}:${e.media_id}`;
        runsByPair.set(k, Math.max(runsByPair.get(k) || 0, e.watch_count || 1));
      }
      const mediaType = new Map(media.map((m) => [m.id, m.media_type || 'tv']));
      const insUm = db.prepare(
        `INSERT INTO user_media (id, user_id, media_id, status, rating, is_private, watch_count, active_run, started_at, completed_at, created_at, updated_at)
         VALUES (@id, @user_id, @media_id, @status, @rating, @is_private, @watch_count, @active_run, @started_at, @completed_at, @created_at, @updated_at)`
      );
      const insEvent = db.prepare(
        'INSERT OR IGNORE INTO watch_events (user_id, media_id, season_number, episode_number, run, watched_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      let events = 0;
      for (const t of um) {
        const type = mediaType.get(t.media_id) || 'tv';
        const status = ['watching', 'to_watch', 'watched', 'dropped'].includes(t.status) ? t.status : 'to_watch';
        const oldCount = t.watch_count || 0;
        const rewatching = umCols.has('is_rewatching') && !!t.is_rewatching;
        const maxRun = runsByPair.get(`${t.user_id}:${t.media_id}`) || 0;
        let watch_count = oldCount;
        let active_run = null;
        if (type === 'tv') {
          if (rewatching) {
            active_run = Math.max(oldCount, 2);
            watch_count = active_run - 1;
          } else if (status === 'watched') {
            watch_count = Math.max(oldCount, 1);
          } else {
            active_run = status === 'watching' || maxRun > 0 ? Math.max(1, maxRun) : null;
            watch_count = active_run ? Math.min(oldCount, active_run - 1) : oldCount;
          }
        } else {
          watch_count = status === 'watched' ? Math.max(oldCount, 1) : oldCount;
        }
        const created = iso(t.created_at) || ts;
        const updated = iso(t.updated_at) || created;
        insUm.run({
          id: t.id,
          user_id: t.user_id,
          media_id: t.media_id,
          status,
          rating: t.rating ? Math.min(10, Math.max(1, Math.round(t.rating * 2))) : null,
          is_private: umCols.has('is_private') && t.is_private ? 1 : 0,
          watch_count,
          active_run,
          started_at: maxRun > 0 || status !== 'to_watch' ? created : null,
          completed_at: status === 'watched' ? updated : null,
          created_at: created,
          updated_at: updated,
        });
        if (type === 'movie') {
          for (let r = 1; r <= watch_count; r++) events += insEvent.run(t.user_id, t.media_id, null, null, r, updated).changes;
        }
      }
      for (const e of oldEpisodes) {
        events += insEvent.run(e.user_id, e.media_id, e.season_number, e.episode_number, e.watch_count || 1, iso(e.watched_at) || ts).changes;
      }
      // v1 let a series be "completed" without every episode being marked (imports, status
      // changes on partially cached shows). Honour the completed status: fill the completed
      // runs so v2 does not report those episodes as new/unwatched.
      const day = ts.slice(0, 10);
      const airedEps = db.prepare('SELECT season_number, episode_number FROM episodes WHERE media_id = ? AND season_number > 0 AND air_date IS NOT NULL AND air_date <= ?');
      let filled = 0;
      for (const t of db.prepare("SELECT um.* FROM user_media um JOIN media m ON m.id = um.media_id WHERE m.media_type = 'tv' AND um.watch_count > 0").all()) {
        const eps = airedEps.all(t.media_id, day);
        for (let run = 1; run <= t.watch_count; run++) {
          for (const ep of eps) filled += insEvent.run(t.user_id, t.media_id, ep.season_number, ep.episode_number, run, t.completed_at || t.updated_at).changes;
        }
      }
      report.filled_events = filled;
      report.tracking = um.length;
      report.watch_events = events;

      // Season splits → cuts
      if (hasTable(old, 'user_season_splits')) {
        const splits = old.prepare('SELECT * FROM user_season_splits').all();
        const ins = db.prepare('INSERT OR IGNORE INTO season_cuts (user_id, media_id, season_number, after_episode, created_at) VALUES (?, ?, ?, ?, ?)');
        for (const s of splits) ins.run(s.user_id, s.media_id, s.original_season_number, s.split_at_episode, iso(s.created_at) || ts);
        report.cuts = splits.length;
      }

      // Lists
      if (hasTable(old, 'user_lists')) {
        const lists = old.prepare('SELECT * FROM user_lists').all();
        const insList = db.prepare('INSERT INTO lists (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
        for (const l of lists) insList.run(l.id, l.user_id, l.name, l.description, iso(l.created_at) || ts, iso(l.updated_at) || ts);
        report.lists = lists.length;
        if (hasTable(old, 'list_items')) {
          const items = old.prepare('SELECT * FROM list_items ORDER BY list_id, item_order').all();
          const insItem = db.prepare('INSERT OR IGNORE INTO list_items (list_id, media_id, position, added_at) VALUES (?, ?, ?, ?)');
          for (const it of items) insItem.run(it.list_id, it.media_id, it.item_order || 0, iso(it.created_at) || ts);
          report.list_items = items.length;
        }
      }

      // Friends
      if (hasTable(old, 'friends')) {
        const rows = old.prepare('SELECT * FROM friends').all();
        const ins = db.prepare('INSERT OR IGNORE INTO friends (id, user_one_id, user_two_id, status, action_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const f of rows) ins.run(f.id, f.user_one_id, f.user_two_id, f.status, f.action_user_id, iso(f.created_at) || ts, iso(f.updated_at) || ts);
        report.friends = rows.length;
      }

      // Activities
      if (hasTable(old, 'user_activities')) {
        const rows = old.prepare('SELECT * FROM user_activities').all();
        const ins = db.prepare('INSERT INTO activities (id, user_id, media_id, list_id, type, details, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const a of rows) {
          let details = a.details;
          if (a.type === 'RATED_MEDIA' && details) {
            try {
              const d = JSON.parse(details);
              if (typeof d.rating === 'number') d.rating = Math.round(d.rating * 2);
              details = JSON.stringify(d);
            } catch {
              /* keep */
            }
          }
          ins.run(a.id, a.user_id, a.media_id, a.list_id, a.type, details, a.is_private ? 1 : 0, iso(a.created_at) || ts);
        }
        report.activities = rows.length;
      }

      // Comments
      if (hasTable(old, 'user_media_comments')) {
        const rows = old.prepare('SELECT * FROM user_media_comments').all();
        const ins = db.prepare('INSERT OR IGNORE INTO comments (id, user_id, media_id, body, is_private, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const c of rows) ins.run(c.id, c.user_id, c.media_id, c.comment, c.is_private ? 1 : 0, iso(c.created_at) || ts, iso(c.updated_at) || ts);
        report.comments = rows.length;
      }

      db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
        'legacy_import',
        JSON.stringify({ at: ts, from: legacyFile, report })
      );
    })();
  } finally {
    old.close();
  }
  log.info(`legacy import: ${JSON.stringify(report)}`);
  return report;
}
