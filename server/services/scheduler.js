// Background TMDB sync: keeps tracked titles fresh and tells users when new seasons/episodes appear.
import { config } from '../config.js';
import { now } from '../db.js';
import { notify } from '../lib/activity.js';
import { refreshMedia } from './media.js';
import { autoResume } from './progress.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** How long a title may go without a sync, based on how "alive" it is. */
export function staleAfter(m) {
  if (m.media_type === 'movie') return 30 * DAY;
  const status = (m.tmdb_status || '').toLowerCase();
  if (m.next_air_date) return 12 * HOUR;
  if (m.in_production || status.includes('returning') || status.includes('production') || status.includes('planned') || status.includes('pilot')) return 2 * DAY;
  return 14 * DAY;
}

export function pickDue(db, limit, at = Date.now()) {
  const rows = db
    .prepare(
      `SELECT m.* FROM media m WHERE EXISTS (SELECT 1 FROM user_media um WHERE um.media_id = m.id AND um.status != 'dropped')
       ORDER BY m.tmdb_synced_at ASC`
    )
    .all();
  return rows.filter((m) => !m.tmdb_synced_at || at - Date.parse(m.tmdb_synced_at) > staleAfter(m)).slice(0, limit);
}

export function fanOut(db, media, diff) {
  if (!diff.newSeasons.length && !diff.newEpisodes.length) return 0;
  const users = db
    .prepare(`SELECT um.user_id, um.status FROM user_media um WHERE um.media_id = ? AND um.status != 'dropped'`)
    .all(media.id);
  const seasons = diff.newSeasons.filter((n) => n > 0);
  const episodes = diff.newEpisodes.filter((e) => e.season_number > 0 && !seasons.includes(e.season_number));
  let n = 0;
  for (const u of users) {
    if (seasons.length) {
      notify(db, { userId: u.user_id, mediaId: media.id, type: 'new_season', payload: { seasons, title: media.title } });
      n++;
    }
    if (episodes.length) {
      notify(db, {
        userId: u.user_id,
        mediaId: media.id,
        type: 'new_episodes',
        payload: { count: episodes.length, first: episodes[0], title: media.title },
      });
      n++;
    }
  }
  return n;
}

export class Scheduler {
  constructor(db, { log = console, batch = config.refreshBatch } = {}) {
    this.db = db;
    this.log = log;
    this.batch = batch;
    this.running = false;
    this.timer = null;
    this.last = null;
  }

  start(intervalMs = config.refreshIntervalMs) {
    this.timer = setInterval(() => this.tick().catch((e) => this.log.error('scheduler tick failed', e)), intervalMs);
    this.timer.unref();
    // First tick shortly after boot so a fresh deployment catches up quickly.
    setTimeout(() => this.tick().catch((e) => this.log.error('scheduler tick failed', e)), 20_000).unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  status() {
    return { running: this.running, last: this.last, interval_minutes: config.refreshIntervalMs / 60_000, batch: this.batch, due: pickDue(this.db, 1000).length };
  }

  async tick({ force = false, limit = this.batch } = {}) {
    if (this.running) return { skipped: true };
    if (!config.tmdbApiKey) return { skipped: true, reason: 'no api key' };
    this.running = true;
    const started = now();
    const result = { started, synced: 0, changed: 0, notifications: 0, resumed: 0, errors: 0 };
    try {
      const due = force
        ? this.db.prepare(`SELECT m.* FROM media m WHERE EXISTS (SELECT 1 FROM user_media um WHERE um.media_id = m.id) ORDER BY m.tmdb_synced_at ASC LIMIT ?`).all(limit)
        : pickDue(this.db, limit);
      for (const m of due) {
        try {
          // A title never synced by v2 (fresh legacy import) has no trustworthy baseline: sync silently.
          const baseline = !m.tmdb_synced_at;
          const r = await refreshMedia(this.db, m.id);
          result.synced++;
          if (baseline) result.baseline = (result.baseline || 0) + 1;
          else if (r && (r.diff.newSeasons.length || r.diff.newEpisodes.length)) {
            result.changed++;
            result.notifications += fanOut(this.db, r.media, r.diff);
            result.resumed += autoResume(this.db, r.media).length;
          }
          await new Promise((res) => setTimeout(res, 250));
        } catch (e) {
          result.errors++;
          if (e.status === 429) {
            this.log.warn(`scheduler: TMDB rate limited, pausing ${e.retryAfter}s`);
            await new Promise((res) => setTimeout(res, (e.retryAfter || 5) * 1000));
          } else if (e.status === 404) {
            this.db.prepare('UPDATE media SET tmdb_synced_at = ? WHERE id = ?').run(now(), m.id);
          } else this.log.warn(`scheduler: failed to sync ${m.media_type}/${m.tmdb_id}: ${e.message}`);
        }
      }
    } finally {
      this.running = false;
      result.finished = now();
      this.last = result;
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('scheduler_last', JSON.stringify(result));
    }
    if (result.synced) this.log.info(`scheduler: synced ${result.synced}, changed ${result.changed}, notified ${result.notifications}, errors ${result.errors}`);
    return result;
  }
}
