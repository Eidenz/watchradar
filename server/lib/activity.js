import { now } from '../db.js';

export const ACTIVITY_TYPES = [
  'TRACKED_MEDIA',
  'RATED_MEDIA',
  'COMPLETED_MEDIA',
  'COMPLETED_REWATCH',
  'WATCHED_EPISODE',
  'STARTED_REWATCH',
  'ADDED_TO_LIST',
  'CREATED_LIST',
];

export function logActivity(db, { userId, mediaId = null, listId = null, type, details = null, isPrivate = false }) {
  db.prepare(
    'INSERT INTO activities (user_id, media_id, list_id, type, details, is_private, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, mediaId, listId, type, details ? JSON.stringify(details) : null, isPrivate ? 1 : 0, now());
}

export function notify(db, { userId, mediaId = null, type, payload = null }) {
  db.prepare('INSERT INTO notifications (user_id, media_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    mediaId,
    type,
    payload ? JSON.stringify(payload) : null,
    now()
  );
}
