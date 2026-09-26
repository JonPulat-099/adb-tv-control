import { execFile } from 'node:child_process';

const ADB = process.env.ADB_PATH || 'adb';

// execFile (no local shell) — arguments are never interpreted by a shell on the server.
// encoding 'buffer' returns raw stdout (binary output such as screencap PNGs).
function run(args, timeout = 8000, encoding = 'utf8') {
  return new Promise((resolve, reject) => {
    const opts = { timeout, windowsHide: true, encoding, maxBuffer: 64 * 1024 * 1024 };
    execFile(ADB, args, opts, (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') {
          err.message = `adb не найден (${ADB}). Установите platform-tools или задайте ADB_PATH`;
          err.statusCode = 503;
        }
        err.stderr = String(stderr || '');
        return reject(err);
      }
      resolve(encoding === 'buffer' ? stdout : String(stdout));
    });
  });
}

export const serialOf = (m) => `${m.ip}:${m.port}`;

async function ensureConnected(m) {
  const out = await run(['connect', serialOf(m)]);
  if (/authenticate/i.test(out)) {
    const e = new Error('Подтвердите запрос отладки на экране ТВ');
    e.statusCode = 409;
    throw e;
  }
  if (!/connected to/i.test(out)) {
    const e = new Error('offline');
    e.offline = true;
    throw e;
  }
}

/** Returns 'online' | 'standby' | 'offline' | 'unauthorized' */
export async function getState(m) {
  let out;
  try {
    out = await run(['connect', serialOf(m)]);
  } catch (e) {
    if (e.code === 'ENOENT') throw e;
    return 'offline';
  }
  if (/authenticate/i.test(out)) return 'unauthorized';
  if (!/connected to/i.test(out)) return 'offline';

  let state;
  try {
    state = (await run(['-s', serialOf(m), 'get-state'], 4000)).trim();
  } catch (e) {
    return /unauthorized/i.test(e.stderr) ? 'unauthorized' : 'offline';
  }
  if (state !== 'device') return 'offline';

  try {
    const power = await run(['-s', serialOf(m), 'shell', 'dumpsys', 'power'], 6000);
    const w = power.match(/mWakefulness=(\w+)/);
    return !w || w[1] === 'Awake' ? 'online' : 'standby';
  } catch {
    return 'offline';
  }
}

export async function runShell(m, args) {
  await ensureConnected(m);
  return run(['-s', serialOf(m), 'shell', ...args], 10000);
}

/** PNG of what the TV is showing right now (DRM content and HDMI inputs come out black). */
export async function screenshot(m) {
  await ensureConnected(m);
  const out = await run(['-s', serialOf(m), 'exec-out', 'screencap', '-p'], 15000, 'buffer');
  // Some firmwares (Xiaomi) print debug lines to stdout before the image
  const start = out.indexOf(PNG_SIG);
  if (start < 0) throw new Error('screencap returned no image');
  return out.subarray(start);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function disconnect(m) {
  return run(['disconnect', serialOf(m)], 4000);
}

export const KEYS = {
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  ok: 'KEYCODE_DPAD_CENTER',
  home: 'KEYCODE_HOME',
  back: 'KEYCODE_BACK',
  vol_up: 'KEYCODE_VOLUME_UP',
  vol_down: 'KEYCODE_VOLUME_DOWN',
  mute: 'KEYCODE_VOLUME_MUTE',
  wake: 'KEYCODE_WAKEUP',
  sleep: 'KEYCODE_SLEEP',
  hdmi1: 'KEYCODE_TV_INPUT_HDMI_1',
  hdmi2: 'KEYCODE_TV_INPUT_HDMI_2',
  hdmi3: 'KEYCODE_TV_INPUT_HDMI_3',
  tv: 'KEYCODE_TV',
};

// Navigation presses are not written to the log (too noisy).
export const NAV_KEYS = new Set(['up', 'down', 'left', 'right', 'ok', 'home', 'back']);

const KEY_LABELS = {
  wake: 'Включение',
  sleep: 'Перевод в ожидание',
  vol_up: 'Громче',
  vol_down: 'Тише',
  mute: 'Звук вкл./выкл.',
  hdmi1: 'Источник: HDMI 1',
  hdmi2: 'Источник: HDMI 2',
  hdmi3: 'Источник: HDMI 3',
  tv: 'Источник: ТВ',
};

const PKG = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

// adb joins shell args and runs them through sh on the TV, so the URL is single-quoted.
const shq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export function buildCommand(action, value) {
  if (action === 'key') {
    const code = KEYS[value];
    if (!code) throw new Error('Неизвестная кнопка');
    return ['input', 'keyevent', code];
  }
  if (action === 'open_url') {
    let u;
    try { u = new URL(value); } catch { throw new Error('Неверный адрес ссылки'); }
    if (!['http:', 'https:'].includes(u.protocol)) {
      throw new Error('Ссылка должна начинаться с http:// или https://');
    }
    return ['am', 'start', '-a', 'android.intent.action.VIEW', '-d', shq(u.href)];
  }
  if (action === 'launch_app') {
    if (!PKG.test(value)) throw new Error('Неверное имя пакета приложения');
    return ['monkey', '-p', value, '-c', 'android.intent.category.LEANBACK_LAUNCHER', '1'];
  }
  throw new Error('Неизвестное действие');
}

export function describe({ action, value }) {
  if (action === 'key') return KEY_LABELS[value] || `Кнопка: ${value}`;
  if (action === 'open_url') return `Открыта ссылка: ${value.slice(0, 120)}`;
  if (action === 'launch_app') return `Запуск приложения: ${value}`;
  return action;
}
