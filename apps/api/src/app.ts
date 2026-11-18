import express, { type Express } from 'express';
import {
  healthResponseSchema,
  type ApiErrorResponse,
} from '@rota-ready/shared';
import type { Db } from './db.js';

export interface AppDependencies {
  db: Db;
}

const DB_HEALTH_TIMEOUT_MS = 1_000;

function checkDb(db: Db): Promise<'ok' | 'down'> {
  const timeout = new Promise<'down'>((resolve) =>
    setTimeout(() => resolve('down'), DB_HEALTH_TIMEOUT_MS).unref(),
  );
  const query = db.$queryRaw`SELECT 1`.then(
    () => 'ok' as const,
    () => 'down' as const,
  );
  return Promise.race([query, timeout]);
}

export function createApp({ db }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', async (_req, res) => {
    res.json(healthResponseSchema.parse({ api: 'ok', db: await checkDb(db) }));
  });

  app.use((_req, res) => {
    res.status(404).json({ code: 'not_found' } satisfies ApiErrorResponse);
  });

  return app;
}
