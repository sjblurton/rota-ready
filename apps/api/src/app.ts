import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { currentUserSchema, healthResponseSchema } from '@rota-ready/shared';
import { withIdentity, withUser, type AuthConfig } from './auth.js';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import type { User } from './generated/prisma/client.js';
import { handleMalformedJson, handleUnexpectedError, sendError } from './http-errors.js';
import { staffLinkRoutes, withoutStaffLinkToken } from './staff-links.js';
import { venueRoutes } from './venues.js';

export interface AppDependencies {
  db: Db;
  clock: Clock;
  authConfig: AuthConfig;
  logger: Logger;
  staffLinkKey: Buffer;
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

export function createApp({
  db,
  clock,
  authConfig,
  logger,
  staffLinkKey,
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: { url: string }) => ({ ...req, url: withoutStaffLinkToken(req.url) }),
      },
    }),
  );
  app.use(express.json());

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

  app.use('/api/venues', venueRoutes(db, authConfig, staffLinkKey, clock));
  app.use('/api/staff-links', staffLinkRoutes(db, clock));

  app.use((_req, res) => sendError(res, 'not_found'));
  app.use(handleMalformedJson);
  app.use(handleUnexpectedError);

  return app;
}
