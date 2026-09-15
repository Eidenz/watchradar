#!/usr/bin/env node
// Usage: node server/scripts/migrate-legacy.js /path/to/old/watchradar.sqlite3 [--force]
// Imports a WatchRadar v1 database into the DB configured by DATA_DIR / DB_FILE.
import { openDb } from '../db.js';
import { config } from '../config.js';
import { importLegacy, isEmpty } from '../services/legacy.js';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Usage: migrate-legacy.js <old.sqlite3> [--force]');
  process.exit(1);
}
const db = openDb();
if (!isEmpty(db) && !flags.includes('--force')) {
  console.error(`Target database ${config.dbFile} already has users. Pass --force to import anyway (ids may collide).`);
  process.exit(2);
}
const report = importLegacy(db, file);
console.log('Imported:', report);
console.log('Note: episode lists will be re-synced from TMDB by the scheduler on the next tick.');
db.close();
