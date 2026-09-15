// Tracking logic: statuses, play-through "runs", episode watches, season cuts.
//
// Model in one paragraph: every viewing is a watch_events row. Rows with a `run` number belong
// to a full play-through of the title (run 1 = first watch, run 2 = first rewatch…); rows with
// run NULL are one-off rewatches of a single episode. user_media.watch_count is how many runs
// have been completed, user_media.active_run is the run currently in progress (NULL if none).
// Progress is always computed against the episodes that have actually aired, so a show that
// gets a new season simply becomes "incomplete" again and the last run resumes.
import { STATUSES } from '../config.js';
import { now, today } from '../db.js';
import { logActivity } from '../lib/activity.js';
import { err } from '../lib/http.js';

export const getTracking = (db, userId, mediaId) =>
  db.prepare('SELECT * FROM user_media WHERE user_id = ? AND media_id = ?').get(userId, mediaId);

const key = (s, e) => `${s}:${e}`;

function update(db, trackingId, fields) {
  const cols = Object.keys(fields);
  db.prepare(`UPDATE user_media SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @updated_at WHERE id = @id`).run({
    ...fields,
    updated_at: now(),
    id: trackingId,
  });
}

/** Non-special episodes that have aired (air_date known and <= today), in order. */
export function airedEpisodes(db, mediaId, day = today()) {
  return db
    .prepare(
      `SELECT season_number, episode_number, title, air_date, runtime FROM episodes
       WHERE media_id = ? AND season_number > 0 AND air_date IS NOT NULL AND air_date <= ? ORDER BY season_number, episode_number`
    )
    .all(mediaId, day);
}

export function runKeys(db, userId, mediaId, run) {
  if (!run) return new Set();
  return new Set(
    db
      .prepare('SELECT season_number, episode_number FROM watch_events WHERE user_id = ? AND media_id = ? AND run = ? AND season_number IS NOT NULL')
      .all(userId, mediaId, run)
      .map((r) => key(r.season_number, r.episode_number))
  );
}

function runIsComplete(db, userId, mediaId, run) {
  const aired = airedEpisodes(db, mediaId);
  if (!aired.length) return false;
  const have = runKeys(db, userId, mediaId, run);
  return aired.every((ep) => have.has(key(ep.season_number, ep.episode_number)));
}

/** Which run new watches should go to when no run is active. */
function resolveRun(db, userId, mediaId, t) {
  if (t.active_run) return t.active_run;
  if (t.watch_count === 0) return 1;
  // Completed before: resume the last run if new episodes aired since, otherwise start a rewatch.
  return runIsComplete(db, userId, mediaId, t.watch_count) ? t.watch_count + 1 : t.watch_count;
}

function openRun(db, userId, media, t) {
  const run = resolveRun(db, userId, media.id, t);
  if (t.active_run !== run) {
    update(db, t.id, { active_run: run, started_at: t.started_at || now() });
    if (run > t.watch_count && t.watch_count > 0) {
      logActivity(db, { userId, mediaId: media.id, type: 'STARTED_REWATCH', details: { run }, isPrivate: !!t.is_private });
    }
  }
  return run;
}

function insertEvents(db, userId, mediaId, run, episodes, watchedAt = now()) {
  const ins = db.prepare(
    'INSERT OR IGNORE INTO watch_events (user_id, media_id, season_number, episode_number, run, watched_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  for (const ep of episodes) n += ins.run(userId, mediaId, ep.season_number, ep.episode_number, run, watchedAt).changes;
  return n;
}

function afterCompletion(db, userId, media, t, run) {
  const grew = run > t.watch_count;
  update(db, t.id, { watch_count: Math.max(t.watch_count, run), active_run: null, status: 'watched', completed_at: now() });
  if (grew) {
    logActivity(db, {
      userId,
      mediaId: media.id,
      type: run === 1 ? 'COMPLETED_MEDIA' : 'COMPLETED_REWATCH',
      details: { run },
      isPrivate: !!t.is_private,
    });
  }
  const user = db.prepare('SELECT auto_remove_from_lists FROM users WHERE id = ?').get(userId);
  if (user?.auto_remove_from_lists) {
    db.prepare('DELETE FROM list_items WHERE media_id = ? AND list_id IN (SELECT id FROM lists WHERE user_id = ?)').run(media.id, userId);
  }
}

function settle(db, userId, media, run) {
  const t = getTracking(db, userId, media.id);
  if (media.media_type === 'tv' && runIsComplete(db, userId, media.id, run)) {
    afterCompletion(db, userId, media, t, run);
    return true;
  }
  return false;
}

// ---- public API ---------------------------------------------------------------------------

export function track(db, userId, media, { status = 'to_watch', watchedAt } = {}) {
  if (!STATUSES.includes(status)) throw err(400, 'Invalid status.');
  if (getTracking(db, userId, media.id)) throw err(409, 'You already track this title.');
  const ts = now();
  db.prepare(
    'INSERT INTO user_media (user_id, media_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, media.id, 'to_watch', ts, ts);
  logActivity(db, { userId, mediaId: media.id, type: 'TRACKED_MEDIA', details: { status } });
  if (status !== 'to_watch') setStatus(db, userId, media, status, { watchedAt });
  return getTracking(db, userId, media.id);
}

export function untrack(db, userId, mediaId) {
  const t = getTracking(db, userId, mediaId);
  if (!t) throw err(404, 'You do not track this title.');
  db.transaction(() => {
    db.prepare('DELETE FROM watch_events WHERE user_id = ? AND media_id = ?').run(userId, mediaId);
    db.prepare('DELETE FROM season_cuts WHERE user_id = ? AND media_id = ?').run(userId, mediaId);
    db.prepare('DELETE FROM list_items WHERE media_id = ? AND list_id IN (SELECT id FROM lists WHERE user_id = ?)').run(mediaId, userId);
    db.prepare('DELETE FROM comments WHERE user_id = ? AND media_id = ?').run(userId, mediaId);
    db.prepare('DELETE FROM activities WHERE user_id = ? AND media_id = ?').run(userId, mediaId);
    db.prepare('DELETE FROM notifications WHERE user_id = ? AND media_id = ?').run(userId, mediaId);
    db.prepare('DELETE FROM user_media WHERE id = ?').run(t.id);
  })();
}

export function setStatus(db, userId, media, status, { watchedAt } = {}) {
  if (!STATUSES.includes(status)) throw err(400, 'Invalid status.');
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  db.transaction(() => {
    if (status === 'watching') {
      update(db, t.id, { status, started_at: t.started_at || now() });
      if (media.media_type === 'tv') openRun(db, userId, media, getTracking(db, userId, media.id));
    } else if (status === 'watched') {
      if (media.media_type === 'tv') {
        const run = resolveRun(db, userId, media.id, t);
        const have = runKeys(db, userId, media.id, run);
        const missing = airedEpisodes(db, media.id).filter((ep) => !have.has(key(ep.season_number, ep.episode_number)));
        insertEvents(db, userId, media.id, run, missing, watchedAt || now());
        afterCompletion(db, userId, media, { ...t, active_run: run }, run);
        if (!runIsComplete(db, userId, media.id, run)) update(db, t.id, { status: 'watched' }); // nothing aired yet: still honour the request
      } else {
        if (t.watch_count === 0) {
          insertEvents(db, userId, media.id, 1, [{ season_number: null, episode_number: null }], watchedAt || now());
          afterCompletion(db, userId, media, t, 1);
        } else update(db, t.id, { status, completed_at: t.completed_at || now() });
      }
    } else {
      update(db, t.id, { status });
    }
  })();
  return getTracking(db, userId, media.id);
}

export function setRating(db, userId, media, rating) {
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  update(db, t.id, { rating });
  if (rating != null && rating !== t.rating) {
    logActivity(db, { userId, mediaId: media.id, type: 'RATED_MEDIA', details: { rating }, isPrivate: !!t.is_private });
  }
  return getTracking(db, userId, media.id);
}

export function setPrivacy(db, userId, mediaId, isPrivate) {
  const t = getTracking(db, userId, mediaId);
  if (!t) throw err(404, 'You do not track this title.');
  update(db, t.id, { is_private: isPrivate ? 1 : 0 });
  db.prepare('UPDATE activities SET is_private = ? WHERE user_id = ? AND media_id = ?').run(isPrivate ? 1 : 0, userId, mediaId);
  db.prepare('UPDATE comments SET is_private = ? WHERE user_id = ? AND media_id = ?').run(isPrivate ? 1 : 0, userId, mediaId);
}

export function setNotes(db, userId, mediaId, notes) {
  const t = getTracking(db, userId, mediaId);
  if (!t) throw err(404, 'You do not track this title.');
  update(db, t.id, { notes: notes || null });
}

function episodeOr404(db, mediaId, s, e) {
  const ep = db.prepare('SELECT * FROM episodes WHERE media_id = ? AND season_number = ? AND episode_number = ?').get(mediaId, s, e);
  if (!ep) throw err(404, 'Unknown episode.');
  return ep;
}

/** Toggle an episode inside the current run. */
export function setEpisodeWatched(db, userId, media, s, e, watched, { watchedAt } = {}) {
  if (media.media_type !== 'tv') throw err(400, 'Not a series.');
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  const ep = episodeOr404(db, media.id, s, e);
  let completed = false;
  db.transaction(() => {
    if (watched) {
      const run = openRun(db, userId, media, t);
      if (!['watching'].includes(t.status)) update(db, t.id, { status: 'watching' });
      const n = insertEvents(db, userId, media.id, run, [ep], watchedAt || now());
      completed = settle(db, userId, media, run);
      if (n && !completed && s > 0) {
        logActivity(db, {
          userId,
          mediaId: media.id,
          type: 'WATCHED_EPISODE',
          details: { season_number: s, episode_number: e, episode_title: ep.title },
          isPrivate: !!t.is_private,
        });
      }
    } else {
      const run = t.active_run ?? t.watch_count;
      if (!run) return;
      const del = db
        .prepare('DELETE FROM watch_events WHERE user_id = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND run = ?')
        .run(userId, media.id, s, e, run);
      if (del.changes && !t.active_run && s > 0) {
        // A completed run just became incomplete → reopen it.
        update(db, t.id, { watch_count: run - 1, active_run: run, status: 'watching' });
      }
    }
  })();
  return { tracking: getTracking(db, userId, media.id), completed };
}

/** Mark every aired episode up to (and including) S/E, or a whole season, as watched in the current run. */
export function markUpTo(db, userId, media, { season, episode, seasonOnly = false, watchedAt } = {}) {
  if (media.media_type !== 'tv') throw err(400, 'Not a series.');
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  let completed = false;
  let marked = 0;
  db.transaction(() => {
    const run = openRun(db, userId, media, t);
    if (t.status !== 'watching') update(db, t.id, { status: 'watching' });
    const have = runKeys(db, userId, media.id, run);
    const targets = airedEpisodes(db, media.id).filter((ep) => {
      if (have.has(key(ep.season_number, ep.episode_number))) return false;
      if (seasonOnly) return ep.season_number === season && (episode == null || ep.episode_number <= episode);
      return ep.season_number < season || (ep.season_number === season && ep.episode_number <= episode);
    });
    marked = insertEvents(db, userId, media.id, run, targets, watchedAt || now());
    completed = settle(db, userId, media, run);
    if (marked && !completed) {
      const last = targets[targets.length - 1];
      logActivity(db, {
        userId,
        mediaId: media.id,
        type: 'WATCHED_EPISODE',
        details: { season_number: last.season_number, episode_number: last.episode_number, episode_title: last.title, count: marked },
        isPrivate: !!t.is_private,
      });
    }
  })();
  return { tracking: getTracking(db, userId, media.id), completed, marked };
}

export function unmarkSeason(db, userId, media, season) {
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  const run = t.active_run ?? t.watch_count;
  if (!run) return getTracking(db, userId, media.id);
  db.transaction(() => {
    const del = db
      .prepare('DELETE FROM watch_events WHERE user_id = ? AND media_id = ? AND season_number = ? AND run = ?')
      .run(userId, media.id, season, run);
    if (del.changes && !t.active_run) update(db, t.id, { watch_count: run - 1, active_run: run, status: 'watching' });
  })();
  return getTracking(db, userId, media.id);
}

/** One-off rewatch of a single episode (not part of a run). */
export function rewatchEpisode(db, userId, media, s, e, { watchedAt } = {}) {
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  episodeOr404(db, media.id, s, e);
  db.prepare('INSERT INTO watch_events (user_id, media_id, season_number, episode_number, run, watched_at) VALUES (?, ?, ?, ?, NULL, ?)').run(
    userId,
    media.id,
    s,
    e,
    watchedAt || now()
  );
  return playCount(db, userId, media.id, s, e);
}

export function undoRewatchEpisode(db, userId, media, s, e) {
  const row = db
    .prepare(
      'SELECT id FROM watch_events WHERE user_id = ? AND media_id = ? AND season_number = ? AND episode_number = ? AND run IS NULL ORDER BY watched_at DESC, id DESC LIMIT 1'
    )
    .get(userId, media.id, s, e);
  if (row) db.prepare('DELETE FROM watch_events WHERE id = ?').run(row.id);
  return playCount(db, userId, media.id, s, e);
}

export const playCount = (db, userId, mediaId, s, e) =>
  db.prepare('SELECT COUNT(*) AS c FROM watch_events WHERE user_id = ? AND media_id = ? AND season_number = ? AND episode_number = ?').get(userId, mediaId, s, e).c;

/** Series: open a fresh run. Movie: log another complete viewing. */
export function startRewatch(db, userId, media, { watchedAt } = {}) {
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  if (media.media_type === 'tv') {
    if (t.active_run) throw err(400, 'A play-through is already in progress.');
    if (t.watch_count < 1) throw err(400, 'Finish the series once before rewatching it.');
    const run = t.watch_count + 1;
    update(db, t.id, { active_run: run, status: 'watching', started_at: now() });
    logActivity(db, { userId, mediaId: media.id, type: 'STARTED_REWATCH', details: { run }, isPrivate: !!t.is_private });
  } else {
    const run = t.watch_count + 1;
    insertEvents(db, userId, media.id, run, [{ season_number: null, episode_number: null }], watchedAt || now());
    update(db, t.id, { watch_count: run, status: 'watched', completed_at: now() });
    logActivity(db, {
      userId,
      mediaId: media.id,
      type: run === 1 ? 'COMPLETED_MEDIA' : 'COMPLETED_REWATCH',
      details: { run },
      isPrivate: !!t.is_private,
    });
  }
  return getTracking(db, userId, media.id);
}

export function cancelRewatch(db, userId, media) {
  const t = getTracking(db, userId, media.id);
  if (!t) throw err(404, 'You do not track this title.');
  if (!t.active_run || t.active_run <= t.watch_count) throw err(400, 'No rewatch in progress.');
  db.transaction(() => {
    db.prepare('DELETE FROM watch_events WHERE user_id = ? AND media_id = ? AND run = ?').run(userId, media.id, t.active_run);
    update(db, t.id, { active_run: null, status: 'watched' });
  })();
  return getTracking(db, userId, media.id);
}

/** Remove one viewing from history (movie run or one-off episode rewatch). */
export function deleteEvent(db, userId, media, eventId) {
  const ev = db.prepare('SELECT * FROM watch_events WHERE id = ? AND user_id = ? AND media_id = ?').get(eventId, userId, media.id);
  if (!ev) throw err(404, 'Unknown viewing.');
  const t = getTracking(db, userId, media.id);
  db.transaction(() => {
    db.prepare('DELETE FROM watch_events WHERE id = ?').run(ev.id);
    if (media.media_type === 'movie' && ev.run != null) {
      // Renumber remaining movie runs so watch_count stays dense.
      const rest = db.prepare('SELECT id FROM watch_events WHERE user_id = ? AND media_id = ? AND run IS NOT NULL ORDER BY watched_at, id').all(userId, media.id);
      rest.forEach((r, i) => db.prepare('UPDATE watch_events SET run = ? WHERE id = ?').run(i + 1, r.id));
      update(db, t.id, { watch_count: rest.length, status: rest.length ? t.status : t.status === 'watched' ? 'to_watch' : t.status });
    } else if (media.media_type === 'tv' && ev.run != null && ev.season_number > 0) {
      const run = ev.run;
      if (!t.active_run && run === t.watch_count) update(db, t.id, { watch_count: run - 1, active_run: run, status: 'watching' });
    }
  })();
  return getTracking(db, userId, media.id);
}

// ---- season cuts ----------------------------------------------------------------------------

export function getCuts(db, userId, mediaId) {
  return db.prepare('SELECT id, season_number, after_episode FROM season_cuts WHERE user_id = ? AND media_id = ? ORDER BY season_number, after_episode').all(userId, mediaId);
}

export function addCut(db, userId, media, season, afterEpisode) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM episodes WHERE media_id = ? AND season_number = ?').get(media.id, season).c;
  if (!count) throw err(404, 'Unknown season.');
  if (afterEpisode < 1 || afterEpisode >= count) throw err(400, `Cut must be between 1 and ${count - 1}.`);
  db.prepare('INSERT OR IGNORE INTO season_cuts (user_id, media_id, season_number, after_episode, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    media.id,
    season,
    afterEpisode,
    now()
  );
  return getCuts(db, userId, media.id);
}

export function removeCut(db, userId, mediaId, cutId) {
  db.prepare('DELETE FROM season_cuts WHERE id = ? AND user_id = ? AND media_id = ?').run(cutId, userId, mediaId);
  return getCuts(db, userId, mediaId);
}

/** Split a season's episode range into parts according to the user's cuts. */
export function seasonParts(episodeCount, cuts) {
  const points = [...new Set(cuts.filter((c) => c >= 1 && c < episodeCount))].sort((a, b) => a - b);
  const parts = [];
  let start = 1;
  points.forEach((p, i) => {
    parts.push({ index: i + 1, start, end: p });
    start = p + 1;
  });
  parts.push({ index: parts.length + 1, start, end: episodeCount });
  const multi = parts.length > 1;
  return parts.map((p) => ({ ...p, label: multi ? `Part ${p.index}` : null, total: p.end - p.start + 1 }));
}

// ---- read models ------------------------------------------------------------------------------

/** Compact progress summary for cards and the detail header. */
export function showProgress(db, userId, media, t) {
  if (media.media_type !== 'tv') return null;
  const run = t.active_run ?? (t.watch_count || null);
  const day = today();
  const all = db
    .prepare('SELECT season_number, episode_number, title, air_date, runtime FROM episodes WHERE media_id = ? AND season_number > 0 ORDER BY season_number, episode_number')
    .all(media.id);
  const have = runKeys(db, userId, media.id, run);
  const aired = all.filter((ep) => ep.air_date && ep.air_date <= day);
  const watched = aired.filter((ep) => have.has(key(ep.season_number, ep.episode_number)));
  const next = aired.find((ep) => !have.has(key(ep.season_number, ep.episode_number))) || null;
  const upcoming = all.find((ep) => !ep.air_date || ep.air_date > day) || null;
  const cuts = getCuts(db, userId, media.id);

  let season = null;
  const focus = next || watched[watched.length - 1] || aired[0] || all[0];
  if (focus) {
    const sn = focus.season_number;
    const inSeason = all.filter((ep) => ep.season_number === sn);
    const parts = seasonParts(inSeason.length, cuts.filter((c) => c.season_number === sn).map((c) => c.after_episode));
    const part = parts.find((p) => focus.episode_number >= p.start && focus.episode_number <= p.end) || parts[0];
    const partEps = inSeason.filter((ep) => ep.episode_number >= part.start && ep.episode_number <= part.end);
    const partAired = partEps.filter((ep) => ep.air_date && ep.air_date <= day);
    const meta = db.prepare('SELECT name FROM seasons WHERE media_id = ? AND season_number = ?').get(media.id, sn);
    season = {
      number: sn,
      name: meta?.name || `Season ${sn}`,
      part_label: part.label,
      part_index: part.index,
      parts: parts.length,
      total: partEps.length,
      aired: partAired.length,
      watched: partAired.filter((ep) => have.has(key(ep.season_number, ep.episode_number))).length,
    };
  }
  const pct = aired.length ? Math.round((watched.length / aired.length) * 100) : 0;
  return {
    run,
    is_rewatch: !!run && run > 1,
    total: all.length,
    aired: aired.length,
    watched: watched.length,
    percent: pct,
    complete: aired.length > 0 && watched.length === aired.length,
    unwatched_aired: aired.length - watched.length,
    next_episode: next
      ? { ...next, code: `S${next.season_number}E${next.episode_number}`, display_number: displayNumber(next, cuts) }
      : null,
    upcoming: upcoming ? { ...upcoming, code: `S${upcoming.season_number}E${upcoming.episode_number}` } : null,
    season,
  };
}

function displayNumber(ep, cuts) {
  const before = cuts.filter((c) => c.season_number === ep.season_number && c.after_episode < ep.episode_number).map((c) => c.after_episode);
  if (!before.length) return ep.episode_number;
  return ep.episode_number - Math.max(...before);
}

export function seasonsWithState(db, userId, media, t) {
  const seasons = db.prepare('SELECT season_number, name, overview, poster_path, air_date, episode_count FROM seasons WHERE media_id = ? ORDER BY season_number').all(media.id);
  const day = today();
  const run = t ? t.active_run ?? (t.watch_count || null) : null;
  const have = t ? runKeys(db, userId, media.id, run) : new Set();
  const cuts = t ? getCuts(db, userId, media.id) : [];
  const eps = db.prepare('SELECT season_number, episode_number, air_date FROM episodes WHERE media_id = ? ORDER BY season_number, episode_number').all(media.id);
  return seasons.map((s) => {
    const inSeason = eps.filter((e) => e.season_number === s.season_number);
    const count = inSeason.length || s.episode_count || 0;
    const parts = seasonParts(count, cuts.filter((c) => c.season_number === s.season_number).map((c) => c.after_episode)).map((p) => {
      const pe = inSeason.filter((e) => e.episode_number >= p.start && e.episode_number <= p.end);
      const aired = pe.filter((e) => e.air_date && e.air_date <= day);
      return { ...p, aired: aired.length, watched: aired.filter((e) => have.has(key(e.season_number, e.episode_number))).length };
    });
    const aired = inSeason.filter((e) => e.air_date && e.air_date <= day);
    return {
      ...s,
      episode_count: count,
      aired: aired.length,
      watched: aired.filter((e) => have.has(key(e.season_number, e.episode_number))).length,
      parts,
      cuts: cuts.filter((c) => c.season_number === s.season_number),
    };
  });
}

export function episodesWithState(db, userId, media, t, season) {
  const day = today();
  const run = t ? t.active_run ?? (t.watch_count || null) : null;
  const have = t ? runKeys(db, userId, media.id, run) : new Set();
  const cuts = t ? getCuts(db, userId, media.id).filter((c) => c.season_number === season) : [];
  const counts = t
    ? new Map(
        db
          .prepare(
            'SELECT episode_number, COUNT(*) AS c, MAX(watched_at) AS last FROM watch_events WHERE user_id = ? AND media_id = ? AND season_number = ? GROUP BY episode_number'
          )
          .all(userId, media.id, season)
          .map((r) => [r.episode_number, r])
      )
    : new Map();
  const eps = db
    .prepare('SELECT season_number, episode_number, tmdb_id, title, overview, air_date, runtime, still_path FROM episodes WHERE media_id = ? AND season_number = ? ORDER BY episode_number')
    .all(media.id, season);
  const parts = seasonParts(eps.length, cuts.map((c) => c.after_episode));
  return eps.map((ep) => {
    const part = parts.find((p) => ep.episode_number >= p.start && ep.episode_number <= p.end) || parts[0];
    const c = counts.get(ep.episode_number);
    return {
      ...ep,
      aired: !!ep.air_date && ep.air_date <= day,
      watched: have.has(key(ep.season_number, ep.episode_number)),
      play_count: c?.c || 0,
      last_watched_at: c?.last || null,
      part_index: part.index,
      part_label: part.label,
      display_number: ep.episode_number - part.start + 1,
    };
  });
}

export function history(db, userId, mediaId, limit = 200) {
  return db
    .prepare(
      `SELECT w.id, w.season_number, w.episode_number, w.run, w.watched_at, e.title AS episode_title
       FROM watch_events w LEFT JOIN episodes e ON e.media_id = w.media_id AND e.season_number = w.season_number AND e.episode_number = w.episode_number
       WHERE w.user_id = ? AND w.media_id = ? ORDER BY w.watched_at DESC, w.id DESC LIMIT ?`
    )
    .all(userId, mediaId, limit);
}

/** Called by the scheduler after new episodes appeared: users with auto_resume get their completed shows reopened. */
export function autoResume(db, media) {
  const rows = db
    .prepare(
      `SELECT um.*, u.auto_resume FROM user_media um JOIN users u ON u.id = um.user_id
       WHERE um.media_id = ? AND um.status = 'watched' AND um.active_run IS NULL AND um.watch_count > 0`
    )
    .all(media.id);
  const resumed = [];
  for (const t of rows) {
    if (!t.auto_resume) continue;
    if (!runIsComplete(db, t.user_id, media.id, t.watch_count)) {
      update(db, t.id, { status: 'watching', active_run: t.watch_count });
      resumed.push(t.user_id);
    }
  }
  return resumed;
}
