import type { Server } from 'node:http';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { pino } from 'pino';
import { createApp } from './app.js';
import type { AuthConfig } from './auth.js';
import { createDb, type Db } from './db.js';

async function unusedAuthConfig(): Promise<AuthConfig> {
  const { publicKey } = await generateKeyPair('ES256');
  return {
    keys: createLocalJWKSet({ keys: [await exportJWK(publicKey)] }),
    issuer: 'http://auth.test/auth/v1',
    audience: 'authenticated',
  };
}

describe('GET /api/health', () => {
  let db: Db;
  let server: Server;
  let response: Response;
  let body: unknown;

  async function requestHealth() {
    server = createApp({
      db,
      authConfig: await unusedAuthConfig(),
      logger: pino({ level: 'silent' }),
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    response = await fetch(`http://localhost:${port}/api/health`);
    body = await response.json();
  }

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  describe('when the database is reachable', () => {
    beforeEach(async () => {
      db = createDb(inject('databaseUrl'));
      await requestHealth();
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('reports both the API and the database as ok', () => {
      expect(body).toEqual({ api: 'ok', db: 'ok' });
    });
  });

  describe('when the database accepts connections but never answers', () => {
    const silentSockets = new Set<Socket>();
    const silentServer = createServer((socket) => silentSockets.add(socket));
    let elapsedMs: number;

    beforeEach(async () => {
      silentServer.listen(0);
      await new Promise<void>((resolve) => silentServer.once('listening', resolve));
      const { port } = silentServer.address() as AddressInfo;
      db = createDb(`postgresql://postgres:postgres@127.0.0.1:${port}/silent`);
      const startedAt = performance.now();
      await requestHealth();
      elapsedMs = performance.now() - startedAt;
    });

    afterEach(async () => {
      for (const socket of silentSockets) socket.destroy();
      silentSockets.clear();
      await new Promise<void>((resolve) => silentServer.close(() => resolve()));
    });

    it('reports the database as down', () => {
      expect(body).toEqual({ api: 'ok', db: 'down' });
    });

    it('answers before the 2s connection timeout would', () => {
      expect(elapsedMs).toBeLessThan(1_800);
    });
  });

  describe('when the database is unreachable', () => {
    beforeEach(async () => {
      db = createDb('postgresql://postgres:postgres@127.0.0.1:1/unreachable');
      await requestHealth();
    });

    it('still responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('reports the database as down', () => {
      expect(body).toEqual({ api: 'ok', db: 'down' });
    });
  });
});
