# WatchRadar v2 — design notes

Why the remake exists, what changed under the hood, and the decisions worth remembering.

## Why

v1 (React + Tailwind + knex) worked but every feature was slightly limited: season splits
were fragile and wiped by a refresh, completing a show could not survive a new season, you could
not rewatch a single episode, ratings were whole stars, nothing told you when a show came back.
v2 is a ground-up rewrite on the house stack (Express + better-sqlite3 + Svelte 5, same shape
as Fuse) with a data model designed around those cases.

## Data model

- `media` / `seasons` / `episodes` mirror TMDB. Episodes are keyed by (season, episode) so user
  data survives resyncs; rows that vanish from TMDB are only deleted when nobody watched them.
- `user_media` holds status, rating (1–10 = half stars), privacy, notes, `watch_count`
  (completed play-throughs) and `active_run` (play-through in progress, NULL if none).
- `watch_events` is the single source of truth for viewings: one row per viewing with an
  optional `run`. Rows with a run belong to a full play-through; rows with run NULL are one-off
  episode rewatches. Everything else (progress, next episode, play counts, hours, history) is
  derived from it.
- `season_cuts` are user-owned split points (`after_episode`). They are never touched by TMDB
  syncs; rendering just ignores cuts past the end of the season.
- Progress is always computed against **aired** episodes. A completed show that grows a season
  simply becomes incomplete again and its last run resumes (no new "rewatch" is created).

Rules that fall out of this (all covered by `server/test/progress.test.js`):

- Watching status with no run → open run 1 (or resume the last incomplete run, or start
  `watch_count + 1` when the last run is complete).
- Completing a run: `watch_count = max(watch_count, run)`, `active_run = NULL`, status watched.
  Only logs an activity when `watch_count` actually grew.
- Unticking an episode of a completed run reopens it (watch_count −1, run active again).
- Cancel rewatch deletes only the events of the abandoned run.
- Rewatching a single episode adds a run-less event; it never affects runs.
- Movies: each viewing is a run; watch_count = number of viewings.

## Scheduler

`services/scheduler.js` ticks every `REFRESH_INTERVAL_MINUTES` and resyncs up to
`REFRESH_BATCH` tracked titles, oldest first, using a staleness rule per title (12h when a next
air date is known, 2 days for returning shows, 14 days for ended ones, 30 days for movies).
New seasons/episodes fan out as notifications to every user tracking the title (except dropped)
and, for users with `auto_resume`, reopen completed shows. Titles never synced by v2 (fresh
legacy import) are synced silently the first time so the migration does not spam notifications.

## Auth

Cookie sessions (`sessions` table, sha256 of a random token, sliding 90-day expiry) instead of
v1's long-lived JWT in localStorage. Writes require the `X-Requested-With: WatchRadar` header as
a CSRF guard. bcrypt hashes from v1 verify unchanged (bcryptjs handles `$2b$`).

## Legacy migration

`services/legacy.js` copies a v1 database with ids preserved. Mapping highlights: v1
`user_episodes.watch_count` → `watch_events.run`; `is_rewatching` → `active_run`; ratings ×2;
splits → cuts; `auto_remove_from_lists_on_watched` → `auto_remove_from_lists`. v1 allowed a
series to be "completed" with only some episodes marked, so the importer fills completed runs
with every cached aired episode (report field `filled_events`). The v1 dev database is used as a
regression fixture in `server/test/legacy.test.js` when present.

## Client

Plain Svelte 5 + Vite, hand-rolled router (`lib/router.svelte.ts`), runes-class stores
(`auth`, `theme`, `toast`, `confirm`), typed API client (`lib/api.ts`). Design tokens in
`app.css` follow the Fuse/MyCalBook contract (RGB triplets, `html.dark`, shared motion tokens);
brand is a radar teal, "signal" amber is used for ratings and new-episode pings. Layout: sidebar
≥1024px, top bar + bottom tab bar below. Titles can be shown in English / original / Japanese
(user preference, resolved client-side and in SSR meta tags).

## Not done / ideas

- Email (password reset) — v1 had none either.
- Per-episode ratings, calendar view of upcoming episodes, PWA manifest.
- Watch providers / trailers from TMDB.
