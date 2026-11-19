import type { Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { Db } from './db.js';
import type { User, Venue } from './generated/prisma/client.js';
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

async function authenticatedUser(
  req: Request,
  res: Response,
  config: AuthConfig,
  db: Db,
): Promise<User | undefined> {
  const identity = await identify(req, config);
  if (!identity) {
    sendError(res, 'unauthorized');
    return undefined;
  }
  const user = await db.user.findUnique({ where: { id: identity.userId } });
  if (!user) {
    sendError(res, 'forbidden');
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

export interface VenueMemberLocals {
  venue: Venue;
}

export type VenueRequestHandler<Params = { venueId: string }> = RequestHandler<
  Params,
  unknown,
  unknown,
  Request['query'],
  VenueMemberLocals
>;

const venueIdSchema = z.uuid();

export function requireVenueMember(config: AuthConfig, db: Db): VenueRequestHandler {
  return async (req, res, next) => {
    const user = await authenticatedUser(req, res, config, db);
    if (!user) return;
    const venueId = venueIdSchema.safeParse(req.params.venueId);
    const membership = venueId.success
      ? await db.venueMember.findUnique({
          where: { userId_venueId: { userId: user.id, venueId: venueId.data } },
          include: { venue: true },
        })
      : null;
    if (!membership) return sendError(res, 'not_found');
    res.locals.venue = membership.venue;
    next();
  };
}
