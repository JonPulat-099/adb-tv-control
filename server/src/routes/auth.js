import bcrypt from 'bcryptjs';
import { db, addLog } from '../db.js';

export default async function authRoutes(app) {
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['login', 'password'],
        properties: {
          login: { type: 'string', minLength: 1, maxLength: 64 },
          password: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
  }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM users WHERE login = ?').get(req.body.login.trim());
    if (!u || !bcrypt.compareSync(req.body.password, u.password_hash)) {
      return reply.code(401).send({ error: 'Неверный логин или пароль' });
    }
    addLog(u.login, 'Вход в систему');
    return {
      token: app.jwt.sign({ id: u.id }),
      user: { id: u.id, login: u.login, name: u.name, role: u.role },
    };
  });

  app.get('/me', { preHandler: app.auth }, async (req) => req.me);
}
