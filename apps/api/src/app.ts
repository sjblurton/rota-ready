import express, { type Express } from 'express';
import { healthResponseSchema } from '@rota-ready/shared';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json(healthResponseSchema.parse({ api: 'ok' }));
  });

  return app;
}
