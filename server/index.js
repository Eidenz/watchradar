import fs from 'node:fs';
import http from 'node:http';
import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { Scheduler } from './services/scheduler.js';
import { importLegacy, isEmpty } from './services/legacy.js';

const log = {
  info: (...a) => console.log(new Date().toISOString(), ...a),
  warn: (...a) => console.warn(new Date().toISOString(), ...a),
  error: (...a) => console.error(new Date().toISOString(), ...a),
};

const db = openDb();

if (config.legacyDb && fs.existsSync(config.legacyDb)) {
  if (isEmpty(db)) {
    log.info(`empty database — importing legacy WatchRadar data from ${config.legacyDb}`);
    try {
      importLegacy(db, config.legacyDb, { log });
    } catch (e) {
      log.error('legacy import failed', e);
    }
  }
}
if (!config.tmdbApiKey) log.warn('TMDB_API_KEY is not set — search and sync will not work.');

const scheduler = new Scheduler(db, { log });
const app = createApp(db, { log, scheduler });
scheduler.start();

const server = http.createServer(app);
server.listen(config.port, config.host, () => {
  log.info(`WatchRadar listening on http://${config.host}:${config.port}  db=${config.dbFile}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log.info(`${sig} received, shutting down`);
    scheduler.stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
