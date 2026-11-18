import type { Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Db } from './db.js';
import type { User } from './generated/prisma/client.js';
import { sendError } from './http-errors.js';

export interface AuthConfig {
  keys: JWTVerifyGetKey;
  issuer: string;
  audience: string;
}

export function supabaseAuthConfig(supabaseUrl: string): AuthConfig {
  const issuer = new URL('/auth/v1', supabaseUrl).href;
  return {
    keys: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
    issuer,
    audience: 'authenticated',
  };
}

interface Identity {
  userId: string;
  email: string;
}

type HandlerWith<Context> = (
  req: Request,
  res: Response,
  context: Context,
) => void | Promise<void>;

function bearerToken(req: Request): string | undefined {
  return /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1];
}

async function identify(req: Request, config: AuthConfig): Promise<Identity | undefined> {
  const token = bearerToken(req);
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, config.keys, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['ES256', 'RS256'],
    });
    if (!payload.sub || typeof payload.email !== 'string') return undefined;
    return { userId: payload.sub, email: payload.email };
  } catch (error) {
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
      return undefined;
    }
    throw error;
  }
}

export function withIdentity(
  config: AuthConfig,
  handler: HandlerWith<Identity>,
): RequestHandler {
  return async (req, res) => {
    const identity = await identify(req, config);
    if (!identity) return sendError(res, 'unauthorized');
    await handler(req, res, identity);
  };
}

export function withUser(
  config: AuthConfig,
  db: Db,
  handler: HandlerWith<User>,
): RequestHandler {
  return withIdentity(config, async (req, res, { userId }) => {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 'forbidden');
    await handler(req, res, user);
  });
}
