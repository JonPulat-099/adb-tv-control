# TV Control Panel

Admin panel for controlling Xiaomi TVs (MiTV-MOOQ1 and other Android TV models) over the network with ADB.

- **server/** — Node.js + Fastify API, SQLite, JWT auth, runs `adb` commands
- **client/** — Vue 3 + Vite + Pinia + Vue Router, Russian UI

Roles: **admin** (everything) and **moderator** (controls TVs, cannot add/delete TVs or manage users). Role checks are enforced on the server; the UI only hides buttons.

## Requirements

- Node.js 20.6+ (uses `--env-file`)
- `adb` on the server machine (`sudo apt install adb` or Android platform-tools)
- The server must be on the same network as the TVs
- On every TV: developer mode + network debugging enabled

> The server has its own ADB key, different from your PC. The first time the server connects,
> each TV shows the "Allow network debugging?" prompt again. Until someone presses **Allow**
> (tick "Always allow"), the panel shows that TV as «Подтвердите на ТВ».

## Development

```bash
# 1. API
cd server
cp .env.example .env      # set JWT_SECRET and ADMIN_PASSWORD
npm install
npm run dev               # http://localhost:3000

# 2. UI (second terminal)
cd client
npm install
npm run dev               # http://localhost:5173, /api is proxied to :3000
```

Log in with `ADMIN_LOGIN` / `ADMIN_PASSWORD` from `.env`. The admin is created only when the users table is empty.

## Production

```bash
cd client && npm ci && npm run build   # creates client/dist
cd ../server && npm ci --omit=dev && npm start
```

Fastify serves `client/dist` and the API on one port. Put nginx in front for HTTPS:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Example systemd unit (`/etc/systemd/system/tv-control.service`):

```ini
[Unit]
Description=TV Control Panel
After=network.target

[Service]
WorkingDirectory=/opt/tv-control/server
ExecStart=/usr/bin/node --env-file=.env src/index.js
Restart=always
User=tvcontrol

[Install]
WantedBy=multi-user.target
```

Run the service as the same user whose `~/.android/adbkey` the TVs have approved.

## API

All routes except login need `Authorization: Bearer <token>`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /api/auth/login | — | `{login, password}` → `{token, user}` |
| GET | /api/auth/me | any | current user |
| GET | /api/monitors | any | list with live status |
| POST | /api/monitors/test | admin | `{ip, port}` → check before adding |
| POST | /api/monitors | admin | `{name, ip, port, location}` |
| PATCH | /api/monitors/:id | admin | `{name, location}` |
| DELETE | /api/monitors/:id | admin | remove + `adb disconnect` |
| POST | /api/monitors/:id/refresh | any | re-check status now |
| PUT | /api/monitors/:id/startup | any | `{url}` — site opened every time the screen turns on (`""` clears) |
| POST | /api/monitors/:id/command | any | `{action, value}` (see below) |
| POST | /api/monitors/bulk | any | `{action: "wake" \| "sleep"}` for all reachable TVs |
| GET/POST | /api/users | admin | list / create (`role`: admin \| moderator) |
| PATCH/DELETE | /api/users/:id | admin | change role or password / delete |
| GET | /api/logs?limit=200 | any | action log |

Commands (`action` / `value`):

- `key`: `wake`, `sleep`, `up`, `down`, `left`, `right`, `ok`, `home`, `back`, `vol_up`, `vol_down`, `mute`, `hdmi1`, `hdmi2`, `hdmi3`, `tv`
- `open_url`: an `http(s)://` URL
- `launch_app`: an Android package name, e.g. `com.google.android.youtube.tv`

Only whitelisted keys are accepted, package names are validated, and URLs are quoted before they reach the TV's shell. `adb` is called with `execFile`, so nothing goes through a shell on the server.

## How status works

Every `POLL_INTERVAL_MS` (default 15 s) the server runs `adb connect`, `get-state` and `dumpsys power` for each TV:

- `online` — screen on
- `standby` — reachable, screen off (can be woken with `KEYCODE_WAKEUP`)
- `unauthorized` — the TV is waiting for someone to allow debugging
- `offline` — no answer (TV unplugged or fully off, wrong IP, network debugging disabled)

If a TV has a startup site, it is opened whenever the TV goes from `standby`/`offline` to `online`: right away (plus ~3 s) when woken from the panel, or on the next status check when turned on with the physical remote. It is not reopened when the server restarts or while the screen stays on.

## Notes

- HDMI keycodes (`KEYCODE_TV_INPUT_HDMI_*`) depend on the firmware. If they don't switch inputs on your model, check with `adb shell input keyevent ...` from your PC first.
- Network ADB gives full control of a TV to anyone on the same network. Keep the TVs in a separate VLAN or firewall port 5555 so only this server can reach it.
- Give each TV a fixed IP (DHCP reservation on the router).
