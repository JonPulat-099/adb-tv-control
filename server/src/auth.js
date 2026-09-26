import { db } from './db.js';

export function setupAuth(app) {
  app.decorateRequest('me', null);

  // Role is re-read from the DB on every request, so a role change applies immediately.
  app.decorate('auth', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Требуется вход' });
    }
    const me = db.prepare('SELECT id, login, name, role FROM users WHERE id = ?').get(req.user.id);
    if (!me) return reply.code(401).send({ error: 'Пользователь не найден' });
    req.me = me;
  });

  app.decorate('adminOnly', async (req, reply) => {
    if (req.me?.role !== 'admin') {
      return reply.code(403).send({ error: 'Только для администратора' });
    }
  });
}
