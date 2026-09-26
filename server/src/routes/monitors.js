import { db, addLog } from '../db.js';
import { buildCommand, runShell, getState, disconnect, NAV_KEYS, describe } from '../adb.js';
import { statusOf, setStatus, clearStatus, checkOne } from '../poller.js';

const octet = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const ipPattern = `^(${octet}\\.){3}${octet}$`;
const port = { type: 'integer', minimum: 1, maximum: 65535 };
const idParams = { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] };

const find = (id) => db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
const withStatus = (m) => ({ ...m, ...statusOf(m.id) });

export default async function monitorRoutes(app) {
  const auth = { preHandler: app.auth };
  const admin = { preHandler: [app.auth, app.adminOnly] };

  app.get('/', auth, async () =>
    db.prepare('SELECT * FROM monitors ORDER BY name COLLATE NOCASE').all().map(withStatus));

  // Check a TV before adding it
  app.post('/test', {
    ...admin,
    schema: {
      body: {
        type: 'object',
        required: ['ip'],
        properties: { ip: { type: 'string', pattern: ipPattern }, port },
      },
    },
  }, async (req) => ({ status: await getState({ ip: req.body.ip, port: req.body.port ?? 5555 }) }));

  app.post('/', {
    ...admin,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'ip'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          location: { type: 'string', maxLength: 120 },
          ip: { type: 'string', pattern: ipPattern },
          port,
        },
      },
    },
  }, async (req, reply) => {
    const { name, location = '', ip, port: p = 5555 } = req.body;
    try {
      const r = db.prepare('INSERT INTO monitors (name, location, ip, port) VALUES (?, ?, ?, ?)')
        .run(name.trim(), location.trim(), ip, p);
      const m = find(r.lastInsertRowid);
      addLog(req.me.login, 'Добавлен монитор', m.name);
      checkOne(m).catch(() => {});
      return reply.code(201).send(withStatus(m));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return reply.code(409).send({ error: 'Монитор с таким IP и портом уже добавлен' });
      }
      throw e;
    }
  });

  app.patch('/:id', {
    ...admin,
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          location: { type: 'string', maxLength: 120 },
        },
      },
    },
  }, async (req, reply) => {
    const m = find(req.params.id);
    if (!m) return reply.code(404).send({ error: 'Монитор не найден' });
    const name = req.body.name?.trim() ?? m.name;
    const location = req.body.location?.trim() ?? m.location;
    db.prepare('UPDATE monitors SET name = ?, location = ? WHERE id = ?').run(name, location, m.id);
    addLog(req.me.login, 'Изменён монитор', name);
    return withStatus(find(m.id));
  });

  app.delete('/:id', { ...admin, schema: { params: idParams } }, async (req, reply) => {
    const m = find(req.params.id);
    if (!m) return reply.code(404).send({ error: 'Монитор не найден' });
    db.prepare('DELETE FROM monitors WHERE id = ?').run(m.id);
    clearStatus(m.id);
    disconnect(m).catch(() => {});
    addLog(req.me.login, 'Удалён монитор', m.name);
    return reply.code(204).send();
  });

  app.post('/:id/refresh', { ...auth, schema: { params: idParams } }, async (req, reply) => {
    const m = find(req.params.id);
    if (!m) return reply.code(404).send({ error: 'Монитор не найден' });
    await checkOne(m);
    return withStatus(m);
  });

  app.post('/:id/command', {
    ...auth,
    schema: {
      params: idParams,
      body: {
        type: 'object',
        required: ['action', 'value'],
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['key', 'open_url', 'launch_app'] },
          value: { type: 'string', minLength: 1, maxLength: 2048 },
        },
      },
    },
  }, async (req, reply) => {
    const m = find(req.params.id);
    if (!m) return reply.code(404).send({ error: 'Монитор не найден' });

    let args;
    try {
      args = buildCommand(req.body.action, req.body.value);
    } catch (e) {
      return reply.code(400).send({ error: e.message });
    }

    try {
      await runShell(m, args);
    } catch (e) {
      addLog(req.me.login, describe(req.body), m.name, false);
      checkOne(m).catch(() => {});
      if (e.statusCode) return reply.code(e.statusCode).send({ error: e.message });
      return reply.code(502).send({ error: `ТВ «${m.name}» не ответил. Проверьте, что он в сети` });
    }

    const { action, value } = req.body;
    if (action === 'key' && value === 'wake') setStatus(m.id, 'online');
    if (action === 'key' && value === 'sleep') setStatus(m.id, 'standby');
    if (!(action === 'key' && NAV_KEYS.has(value))) addLog(req.me.login, describe(req.body), m.name);

    return { ok: true, ...statusOf(m.id) };
  });

  // Wake / sleep every reachable TV
  app.post('/bulk', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['action'],
        properties: { action: { type: 'string', enum: ['wake', 'sleep'] } },
      },
    },
  }, async (req) => {
    const { action } = req.body;
    const targets = db.prepare('SELECT * FROM monitors').all()
      .filter((m) => ['online', 'standby'].includes(statusOf(m.id).status));
    const args = buildCommand('key', action);
    const results = await Promise.allSettled(targets.map(async (m) => {
      await runShell(m, args);
      setStatus(m.id, action === 'wake' ? 'online' : 'standby');
    }));
    const done = results.filter((r) => r.status === 'fulfilled').length;
    addLog(
      req.me.login,
      action === 'wake' ? 'Включение (все)' : 'Ожидание (все)',
      `Успешно: ${done} из ${targets.length}`,
      done === targets.length,
    );
    return { done, total: targets.length };
  });
}
