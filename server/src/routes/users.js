import bcrypt from 'bcryptjs';
import { db, addLog, adminCount } from '../db.js';

const role = { type: 'string', enum: ['admin', 'moderator'] };
const idParams = { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] };
const roleName = (r) => (r === 'admin' ? 'администратор' : 'модератор');
const publicUser = (id) =>
  db.prepare('SELECT id, login, name, role, created_at FROM users WHERE id = ?').get(id);

export default async function userRoutes(app) {
  // The whole section is admin-only
  app.addHook('preHandler', app.auth);
  app.addHook('preHandler', app.adminOnly);

  app.get('/', async () =>
    db.prepare('SELECT id, login, name, role, created_at FROM users ORDER BY id').all());

  app.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['login', 'name', 'password', 'role'],
        additionalProperties: false,
        properties: {
          login: { type: 'string', pattern: '^[A-Za-z0-9_.-]{3,32}$' },
          name: { type: 'string', minLength: 1, maxLength: 80 },
          password: { type: 'string', minLength: 8, maxLength: 200 },
          role,
        },
      },
    },
  }, async (req, reply) => {
    const { login, name, password, role: r } = req.body;
    try {
      const res = db.prepare('INSERT INTO users (login, name, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(login, name.trim(), bcrypt.hashSync(password, 10), r);
      addLog(req.me.login, `Добавлен пользователь (${roleName(r)})`, login);
      return reply.code(201).send(publicUser(res.lastInsertRowid));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return reply.code(409).send({ error: 'Такой логин уже занят' });
      }
      throw e;
    }
  });

  app.patch('/:id', {
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          password: { type: 'string', minLength: 8, maxLength: 200 },
          role,
        },
      },
    },
  }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return reply.code(404).send({ error: 'Пользователь не найден' });

    const { name, password, role: r } = req.body;
    if (r && r !== u.role && u.role === 'admin' && adminCount() <= 1) {
      return reply.code(400).send({ error: 'Должен остаться хотя бы один администратор' });
    }

    db.prepare('UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?').run(
      name?.trim() ?? u.name,
      r ?? u.role,
      password ? bcrypt.hashSync(password, 10) : u.password_hash,
      u.id,
    );
    if (r && r !== u.role) addLog(req.me.login, `Смена роли: ${roleName(r)}`, u.login);
    if (password) addLog(req.me.login, 'Смена пароля', u.login);
    return publicUser(u.id);
  });

  app.delete('/:id', { schema: { params: idParams } }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return reply.code(404).send({ error: 'Пользователь не найден' });
    if (u.id === req.me.id) return reply.code(400).send({ error: 'Нельзя удалить самого себя' });
    if (u.role === 'admin' && adminCount() <= 1) {
      return reply.code(400).send({ error: 'Должен остаться хотя бы один администратор' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    addLog(req.me.login, 'Удалён пользователь', u.login);
    return reply.code(204).send();
  });
}
