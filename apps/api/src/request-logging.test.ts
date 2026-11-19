import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { createApp } from './app.js';
import { createDb, type Db } from './db.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const INFO = pino.levels.values.info;
const ERROR = pino.levels.values.error;
const UNREACHABLE_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/postgres';

interface LogLine {
  level: number;
  msg: string;
  req?: { method: string; path: string };
  res?: { statusCode: number };
  err?: { message: string };
  responseTime?: number;
}

describe('request logging and unexpected errors', () => {
  let db: Db;
  let server: Server;
  let baseUrl: string;
  let signingKey: CryptoKey;
  let rawLog: string[];
  let response: Response;

  async function startApp(databaseUrl: string) {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    signingKey = privateKey;
    const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
    rawLog = [];
    db = createDb(databaseUrl);
    server = createApp({
      db,
      authConfig: {
        keys: createLocalJWKSet({ keys: [publicJwk] }),
        issuer: ISSUER,
        audience: 'authenticated',
      },
      logger: pino({ level: 'info' }, { write: (line: string) => rawLog.push(line) }),
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  }

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  function signToken() {
    return new SignJWT({ email: OWNER.email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject(OWNER.id)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(signingKey);
  }

  function logLines(): LogLine[] {
    return rawLog.map((line) => JSON.parse(line) as LogLine);
  }

  async function waitForRequestLog() {
    await vi.waitFor(() => expect(logLines().some((line) => line.res)).toBe(true));
  }

  describe('when the database is reachable', () => {
    beforeEach(async () => {
      await startApp(inject('databaseUrl'));
    });

    describe('when a request succeeds', () => {
      beforeEach(async () => {
        response = await fetch(`${baseUrl}/api/health`);
        await waitForRequestLog();
      });

      it('logs one line at info level with the method, path, status and duration', () => {
        expect(logLines()).toEqual([
          expect.objectContaining({
            level: INFO,
            req: { method: 'GET', path: '/api/health' },
            res: { statusCode: 200 },
            responseTime: expect.any(Number),
          }),
        ]);
      });
    });

    describe('when the URL has a query string', () => {
      beforeEach(async () => {
        response = await fetch(`${baseUrl}/api/health?email=someone@example.com`);
        await waitForRequestLog();
      });

      it('logs the path without the query string', () => {
        expect(logLines()[0]?.req).toEqual({ method: 'GET', path: '/api/health' });
      });
    });

    describe('when a request carries a bearer token and a body', () => {
      let token: string;

      beforeEach(async () => {
        token = await signToken();
        response = await fetch(`${baseUrl}/api/venues`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Secret Venue Name', timeZone: 'Europe/London' }),
        });
        await waitForRequestLog();
      });

      it('leaves the token out of the log', () => {
        expect(rawLog.join('')).not.toContain(token);
      });

      it('leaves the request body out of the log', () => {
        expect(rawLog.join('')).not.toContain('Secret Venue Name');
      });
    });

    describe('when a Staff Link URL is requested in mixed case', () => {
      beforeEach(async () => {
        response = await fetch(`${baseUrl}/API/Staff-Links/s3cr3t-staff-link-token/shifts`);
        await waitForRequestLog();
      });

      it('leaves the token out of the log', () => {
        expect(rawLog.join('')).not.toContain('s3cr3t-staff-link-token');
      });
    });

    describe('when a Staff Link URL is requested', () => {
      beforeEach(async () => {
        response = await fetch(`${baseUrl}/api/staff-links/s3cr3t-staff-link-token/shifts`);
        await waitForRequestLog();
      });

      it('logs the path with the token redacted', () => {
        expect(logLines()[0]?.req).toEqual({
          method: 'GET',
          path: '/api/staff-links/[redacted]/shifts',
        });
      });

      it('leaves the token out of the log', () => {
        expect(rawLog.join('')).not.toContain('s3cr3t-staff-link-token');
      });
    });
  });

  describe('when a route throws because the database is unreachable', () => {
    beforeEach(async () => {
      await startApp(UNREACHABLE_DATABASE_URL);
      response = await fetch(`${baseUrl}/api/me`, {
        headers: { authorization: `Bearer ${await signToken()}` },
      });
      await waitForRequestLog();
    });

    it('responds with 500', () => {
      expect(response.status).toBe(500);
    });

    it('carries only the internal_error code, with no message or stack', async () => {
      expect(await response.json()).toEqual({ code: 'internal_error' });
    });

    it('logs the error once, at error level, with the method and path', () => {
      expect(logLines().filter((line) => line.err)).toEqual([
        expect.objectContaining({
          level: ERROR,
          req: { method: 'GET', path: '/api/me' },
          res: { statusCode: 500 },
          err: expect.objectContaining({ message: expect.any(String) }),
        }),
      ]);
    });
  });
});
