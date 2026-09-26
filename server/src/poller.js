import { db, addLog } from './db.js';
import { getState, runShell, buildCommand } from './adb.js';

const statuses = new Map();
const lastAutoOpen = new Map();

export const statusOf = (id) =>
  statuses.get(Number(id)) ?? { status: 'unknown', checkedAt: null };

export function setStatus(id, status) {
  statuses.set(Number(id), { status, checkedAt: new Date().toISOString() });
}

export const clearStatus = (id) => statuses.delete(Number(id));

// Opens the TV's startup site. The 30 s guard stops the poller and the wake route
// from both firing for the same power-on.
export function autoOpen(m, delayMs = 0) {
  if (!m.startup_url) return;
  const last = lastAutoOpen.get(m.id) ?? 0;
  if (Date.now() - last < 30000) return;
  lastAutoOpen.set(m.id, Date.now());

  setTimeout(async () => {
    let ok = true;
    try {
      await runShell(m, buildCommand('open_url', m.startup_url));
    } catch {
      ok = false;
    }
    addLog('система', 'Автооткрытие ссылки', m.name, ok);
  }, delayMs);
}

export async function checkOne(m) {
  const prev = statusOf(m.id).status;
  try {
    const s = await getState(m);
    setStatus(m.id, s);
    // 'unknown' is skipped so a server restart doesn't reopen sites on TVs that are already on
    if (s === 'online' && (prev === 'standby' || prev === 'offline')) autoOpen(m);
    return s;
  } catch (e) {
    setStatus(m.id, 'offline');
    throw e;
  }
}

export function startPoller(log) {
  const interval = Number(process.env.POLL_INTERVAL_MS) || 15000;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const monitors = db.prepare('SELECT * FROM monitors').all();
      const results = await Promise.allSettled(monitors.map(checkOne));
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) log.warn(failed.reason.message);
    } finally {
      running = false;
    }
  };

  tick();
  return setInterval(tick, interval);
}
