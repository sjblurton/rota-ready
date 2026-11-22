import { apiErrorCode } from '@rota-ready/shared';
import type { Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
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

export interface Identity {
  userId: string;
  email: string;
}

export type HandlerWith<Context> = (
  req: Request,
  res: Response,
  context: Context,
) => void | Promise<void>;

function bearerToken(req: Request): string | undefined {
  return /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1];
}

export async function identify(req: Request, config: AuthConfig): Promise<Identity | undefined> {
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
    if (!identity) return sendError(res, apiErrorCode.unauthorized);
    await handler(req, res, identity);
  };
}
