import { db } from '../db.js';

export default async function logRoutes(app) {
  app.get('/', {
    preHandler: app.auth,
    schema: {
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 1000, default: 200 } },
      },
    },
  }, async (req) =>
    db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(req.query.limit));
}
