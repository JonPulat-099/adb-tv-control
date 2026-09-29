# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Admin panel for controlling Xiaomi / Android TVs over network ADB. Two independent Yarn (Classic 1.x) packages, no root package.json, no tests, no linter configured.

## Commands

```bash
# API (Node 20.6+, needs server/.env — copy .env.example, set JWT_SECRET ≥32 chars and ADMIN_PASSWORD ≠ "change-me")
cd server && yarn install && yarn dev         # node --watch, http://localhost:5050

# UI (second terminal)
cd client && yarn install && yarn dev         # Vite on :3223, proxies /api → :5050

# Production: build client, then server serves client/dist + API on one port
cd client && yarn build && cd ../server && yarn start
```

`adb` must be installed on the server machine (or set `ADB_PATH`). The server will refuse to start without a valid `JWT_SECRET`, and `seedAdmin()` throws on an empty users table if `ADMIN_PASSWORD` is unset/default.

## Architecture

**Server** (`server/src/`, Fastify 5, ESM, better-sqlite3 — synchronous DB calls, no ORM/migrations; schema is `CREATE TABLE IF NOT EXISTS` in `db.js`, new columns also need an `ALTER TABLE` guard there for existing databases).

- `adb.js` is the only place that touches `adb`. Always via `execFile` (no local shell). Commands sent to a TV go through `buildCommand(action, value)`, which enforces a key whitelist (`KEYS`), a package-name regex, and http(s)-only URLs that are single-quoted with `shq()` because adb re-runs shell args through `sh` on the TV. Any new command type must follow this pattern.
- `poller.js` keeps TV status **in memory only** (a `Map` keyed by monitor id; not persisted). A background tick every `POLL_INTERVAL_MS` calls `getState()` for each TV → `online | standby | offline | unauthorized` (`unknown` until first check). Routes read it with `statusOf()` and optimistically update it with `setStatus()` after wake/sleep. A `standby`/`offline` → `online` transition (in `checkOne()`, or the wake routes) calls `autoOpen()`, which opens the TV's `startup_url`; a 30 s per-TV guard prevents double opens.
- `auth.js` decorates `app.auth` (JWT verify + reloads the user from DB on every request, so role changes apply immediately) and `app.adminOnly`. Routes attach them as `preHandler`. **Role enforcement lives only here on the server** — the client's `isAdmin` checks just hide UI.
- Routes use Fastify JSON schemas for validation; the global error handler in `index.js` replaces validation errors and 5xx messages with generic Russian text. Errors meant for the user are thrown/sent with a `statusCode` and a Russian message (e.g. adb missing → 503, TV awaiting authorization → 409, TV unreachable → 502).
- `addLog()` writes the action log. Navigation key presses (`NAV_KEYS`) are intentionally not logged. `describe()` produces the Russian log label.
- Invariants in `routes/users.js`: at least one admin must remain; users can't delete themselves.

**Client** (`client/src/`, Vue 3 `<script setup>` + Pinia + Vue Router, plain CSS in `style.css` with CSS variables, no UI library).

- `api.js` is the single fetch wrapper: adds the Bearer token from `localStorage`, throws `Error(data.error)` so server messages are shown directly, and dispatches a `auth:expired` window event on 401 (handled in `main.js`).
- `stores/monitors.js` polls `GET /api/monitors` every 5 s while the monitors view is mounted and patches status locally from command/refresh responses.
- `status.js` maps status keys to Russian labels and colour variables; `formatTime()` handles SQLite's zone-less UTC `CURRENT_TIMESTAMP`.
- Router guard in `router.js` loads `/auth/me` lazily and redirects non-admins away from `meta.admin` routes.

## Conventions

- All user-facing strings (UI and server error/log messages) are in **Russian**; code and comments are in English.
- API surface and command reference are documented in `README.md` — keep it in sync when adding routes or actions.
