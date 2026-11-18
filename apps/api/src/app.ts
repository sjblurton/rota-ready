import express, { type Express } from 'express';
import { currentUserSchema, healthResponseSchema } from '@rota-ready/shared';
import { withIdentity, withUser, type AuthConfig } from './auth.js';
import type { Db } from './db.js';
import type { User } from './generated/prisma/client.js';
import { sendError } from './http-errors.js';

export interface AppDependencies {
  db: Db;
  authConfig: AuthConfig;
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

function toCurrentUser({ id, email }: User) {
  return currentUserSchema.parse({ id, email });
}

export function createApp({ db, authConfig }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', async (_req, res) => {
    res.json(healthResponseSchema.parse({ api: 'ok', db: await checkDb(db) }));
  });

  app.put(
    '/api/me',
    withIdentity(authConfig, async (_req, res, { userId, email }) => {
      const user = await db.user.upsert({
        where: { id: userId },
        create: { id: userId, email },
        update: { email },
      });
      res.json(toCurrentUser(user));
    }),
  );

  app.get(
    '/api/me',
    withUser(authConfig, db, (_req, res, user) => {
      res.json(toCurrentUser(user));
    }),
  );

  app.use((_req, res) => sendError(res, 'not_found'));

  return app;
}
