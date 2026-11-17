import express, { type Express } from 'express';
import { healthResponseSchema } from '@rota-ready/shared';
import type { Db } from './db.js';

export interface AppDependencies {
  db: Db;
}

export function createApp({ db }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', async (_req, res) => {
    const dbStatus = await db.$queryRaw`SELECT 1`.then(
      () => 'ok' as const,
      () => 'down' as const,
    );
    res.json(healthResponseSchema.parse({ api: 'ok', db: dbStatus }));
  });

  return app;
}
