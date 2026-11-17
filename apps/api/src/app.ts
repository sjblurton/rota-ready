import express, { type Express } from 'express';
import { healthResponseSchema } from '@rota-ready/shared';

/**
 * Builds the API. Tests and production both go through this factory; later
 * tickets add injected dependencies (db, clock, emailSender, authConfig).
 * Never branch on NODE_ENV in here.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json(healthResponseSchema.parse({ api: 'ok' }));
  });

  return app;
}
