import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { seedAdmin } from './db.js';
import { setupAuth } from './auth.js';
import { startPoller } from './poller.js';
import authRoutes from './routes/auth.js';
import monitorRoutes from './routes/monitors.js';
import userRoutes from './routes/users.js';
import logRoutes from './routes/logs.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set in .env and be at least 32 characters');
  process.exit(1);
}
seedAdmin();

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

app.setErrorHandler((err, req, reply) => {
  const code = err.statusCode || 500;
  if (code >= 500) req.log.error(err);
  let error = err.message;
  if (err.validation) error = 'Проверьте введённые данные';
  else if (code >= 500 && code !== 503) error = 'Внутренняя ошибка сервера';
  reply.code(code).send({ error });
});

await app.register(rateLimit, { global: false });
await app.register(jwt, { secret: process.env.JWT_SECRET, sign: { expiresIn: '12h' } });
setupAuth(app);

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(monitorRoutes, { prefix: '/api/monitors' });
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(logRoutes, { prefix: '/api/logs' });

// In production Fastify also serves the built Vue app
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist });
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api')) return reply.sendFile('index.html');
    reply.code(404).send({ error: 'Не найдено' });
  });
}

startPoller(app.log);
await app.listen({ host: process.env.HOST || '0.0.0.0', port: Number(process.env.PORT) || 5050 });
