import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp } from './app.js';
import { createDb, type Db } from './db.js';

describe('GET /api/health', () => {
  let db: Db;
  let server: Server;
  let response: Response;
  let body: unknown;

  async function requestHealth() {
    server = createApp({ db }).listen(0);
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
