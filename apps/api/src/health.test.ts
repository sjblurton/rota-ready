import { createServer, type AddressInfo, type Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '#test/test-app.js';

describe('GET /api/health', () => {
  let app: TestApp;
  let response: Response;
  let body: unknown;

  async function requestHealth(databaseUrl?: string) {
    app = await startTestApp(databaseUrl ? { databaseUrl } : {});
    response = await app.request('GET', '/api/health');
    body = await response.json();
  }

  afterEach(() => app.close());

  describe('when the database is reachable', () => {
    beforeEach(async () => {
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
      const startedAt = performance.now();
      await requestHealth(`postgresql://postgres:postgres@127.0.0.1:${port}/silent`);
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
      await requestHealth('postgresql://postgres:postgres@127.0.0.1:1/unreachable');
    });

    it('still responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('reports the database as down', () => {
      expect(body).toEqual({ api: 'ok', db: 'down' });
    });
  });
});
