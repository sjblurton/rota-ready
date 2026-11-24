import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { apiErrorCode, healthResponseSchema } from '@rota-ready/shared';
import { staffLinkRouter } from '#src/features/staff-links/staff-link-router.js';
import { withoutStaffLinkToken } from '#src/features/staff-links/staff-link-token.js';
import { userRouter } from '#src/features/users/user-router.js';
import { venueRouter } from '#src/features/venues/venue-router.js';
import type { AuthConfig } from '#src/lib/auth.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import type { EmailSender } from '#src/lib/email-sender.js';
import { handleMalformedJson, handleUnexpectedError, sendError } from '#src/lib/http-errors.js';

export interface AppDependencies {
  db: Db;
  clock: Clock;
  authConfig: AuthConfig;
  logger: Logger;
  staffLinkKey: Buffer;
  emailSender: EmailSender;
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

export function createApp(dependencies: AppDependencies): Express {
  const { db, clock, authConfig, logger } = dependencies;
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

  app.use('/api/me', userRouter({ db, authConfig }));
  app.use('/api/venues', venueRouter(dependencies));
  app.use('/api/staff-links', staffLinkRouter({ db, clock }));

  app.use((_req, res) => sendError(res, apiErrorCode.not_found));
  app.use(handleMalformedJson);
  app.use(handleUnexpectedError);

  return app;
}
