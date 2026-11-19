import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from 'jose';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { pino } from 'pino';
import { createApp } from './app.js';
import { createDb, type Db } from './db.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
const USER_ID = '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a';
const EMAIL = 'owner@example.com';

describe('/api/me', () => {
  let db: Db;
  let server: Server;
  let baseUrl: string;
  let signingKey: CryptoKey;
  let response: Response;

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    signingKey = privateKey;
    const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
    db = createDb(inject('databaseUrl'));
    server = createApp({
      db,
      logger: pino({ level: 'silent' }),
      authConfig: {
        keys: createLocalJWKSet({ keys: [publicJwk] }),
        issuer: ISSUER,
        audience: 'authenticated',
      },
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  function signToken({
    key = signingKey,
    issuer = ISSUER,
    expiresAt = '1h',
  }: { key?: CryptoKey; issuer?: string; expiresAt?: string | number } = {}) {
    return new SignJWT({ email: EMAIL, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject(USER_ID)
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(key);
  }

  function request(method: 'GET' | 'PUT', token?: string) {
    return fetch(`${baseUrl}/api/me`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  async function signTokenWithAnotherKey() {
    const { privateKey } = await generateKeyPair('ES256');
    return signToken({ key: privateKey });
  }

  describe('GET', () => {
    describe('when no token is sent', () => {
      beforeEach(async () => {
        response = await request('GET');
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });

      it('carries the unauthorized code', async () => {
        expect(await response.json()).toEqual({ code: 'unauthorized' });
      });
    });

    describe('when the token is signed with the wrong key', () => {
      beforeEach(async () => {
        response = await request('GET', await signTokenWithAnotherKey());
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token has expired', () => {
      beforeEach(async () => {
        const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
        response = await request('GET', await signToken({ expiresAt: oneMinuteAgo }));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token was issued by another issuer', () => {
      beforeEach(async () => {
        response = await request(
          'GET',
          await signToken({ issuer: 'http://elsewhere.test/auth/v1' }),
        );
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token is valid but no User row exists', () => {
      beforeEach(async () => {
        response = await request('GET', await signToken());
      });

      it('responds with 403', () => {
        expect(response.status).toBe(403);
      });

      it('carries the forbidden code', async () => {
        expect(await response.json()).toEqual({ code: 'forbidden' });
      });
    });

    describe('when the token is valid and the User exists', () => {
      beforeEach(async () => {
        await db.user.create({ data: { id: USER_ID, email: EMAIL } });
        response = await request('GET', await signToken());
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the User', async () => {
        expect(await response.json()).toEqual({ id: USER_ID, email: EMAIL });
      });
    });
  });

  describe('PUT', () => {
    describe('when the token is signed with the wrong key', () => {
      beforeEach(async () => {
        response = await request('PUT', await signTokenWithAnotherKey());
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });

      it('creates no User', async () => {
        expect(await db.user.count()).toBe(0);
      });
    });

    describe('when the token is valid and no User row exists', () => {
      beforeEach(async () => {
        response = await request('PUT', await signToken());
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the new User', async () => {
        expect(await response.json()).toEqual({ id: USER_ID, email: EMAIL });
      });

      it('stores the User keyed by the token subject', async () => {
        expect(await db.user.findMany({ select: { id: true, email: true } })).toEqual([
          { id: USER_ID, email: EMAIL },
        ]);
      });

      describe('when it is called again', () => {
        beforeEach(async () => {
          response = await request('PUT', await signToken());
        });

        it('returns the same User', async () => {
          expect(await response.json()).toEqual({ id: USER_ID, email: EMAIL });
        });

        it('still stores only one User', async () => {
          expect(await db.user.count()).toBe(1);
        });
      });
    });

    describe('when the User already exists with an older email address', () => {
      beforeEach(async () => {
        await db.user.create({ data: { id: USER_ID, email: 'old@example.com' } });
        response = await request('PUT', await signToken());
      });

      it('returns the email address from the token', async () => {
        expect(await response.json()).toEqual({ id: USER_ID, email: EMAIL });
      });

      it('stores the email address from the token', async () => {
        expect(await db.user.findUnique({ where: { id: USER_ID } })).toMatchObject({
          email: EMAIL,
        });
      });
    });
  });
});
