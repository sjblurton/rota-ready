import { apiErrorCode } from '@rota-ready/shared';
import type { Request, RequestHandler, Response } from 'express';
import type { User } from '#src/generated/prisma/client.js';
import { identify, type AuthConfig, type HandlerWith } from '#src/lib/auth.js';
import type { Db } from '#src/lib/db.js';
import { sendError } from '#src/lib/http-errors.js';
import { createUserService } from './user-service.js';

export async function authenticatedUser(
  req: Request,
  res: Response,
  config: AuthConfig,
  db: Db,
): Promise<User | undefined> {
  const identity = await identify(req, config);
  if (!identity) {
    sendError(res, apiErrorCode.unauthorized);
    return undefined;
  }
  const user = await createUserService({ db }).find(identity.userId);
  if (!user) {
    sendError(res, apiErrorCode.forbidden);
    return undefined;
  }
  return user;
}

export function withUser(
  config: AuthConfig,
  db: Db,
  handler: HandlerWith<User>,
): RequestHandler {
  return async (req, res) => {
    const user = await authenticatedUser(req, res, config, db);
    if (user) await handler(req, res, user);
  };
}
