import { db } from './db.js';
import { getState } from './adb.js';

const statuses = new Map();

export const statusOf = (id) =>
  statuses.get(Number(id)) ?? { status: 'unknown', checkedAt: null };

export function setStatus(id, status) {
  statuses.set(Number(id), { status, checkedAt: new Date().toISOString() });
}

export const clearStatus = (id) => statuses.delete(Number(id));

export async function checkOne(m) {
  try {
    const s = await getState(m);
    setStatus(m.id, s);
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
