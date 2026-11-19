import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { pino } from 'pino';
import { createApp } from './app.js';
import { createDb, type Db } from './db.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
const UNREACHABLE_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/postgres';

describe('API error responses', () => {
  let db: Db;
  let server: Server;
  let baseUrl: string;
  let signingKey: CryptoKey;
  let response: Response;

  async function startApp(databaseUrl: string) {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    signingKey = privateKey;
    const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
    db = createDb(databaseUrl);
    server = createApp({
      db,
      authConfig: {
        keys: createLocalJWKSet({ keys: [publicJwk] }),
        issuer: ISSUER,
        audience: 'authenticated',
      },
      logger: pino({ level: 'silent' }),
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  }

  function signToken() {
    return new SignJWT({ email: 'owner@example.com', role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject('2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(signingKey);
  }

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  describe('when a route that does not exist is requested', () => {
    beforeEach(async () => {
      await startApp(inject('databaseUrl'));
      response = await fetch(`${baseUrl}/api/no-such-route`);
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('carries the not_found code and no server-written message', async () => {
      expect(await response.json()).toEqual({ code: 'not_found' });
    });
  });

  describe('when a route throws because the database is unreachable', () => {
    beforeEach(async () => {
      await startApp(UNREACHABLE_DATABASE_URL);
      response = await fetch(`${baseUrl}/api/me`, {
        headers: { authorization: `Bearer ${await signToken()}` },
      });
    });

    it('responds with 500', () => {
      expect(response.status).toBe(500);
    });

    it('carries only the internal_error code, with no message or stack', async () => {
      expect(await response.json()).toEqual({ code: 'internal_error' });
    });
  });
});
