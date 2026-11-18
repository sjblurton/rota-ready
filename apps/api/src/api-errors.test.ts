import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
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

describe('API error responses', () => {
  let db: Db;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    db = createDb(inject('databaseUrl'));
    server = createApp({ db, authConfig: await unusedAuthConfig() }).listen(0);
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

  describe('when a route that does not exist is requested', () => {
    let response: Response;

    beforeEach(async () => {
      response = await fetch(`${baseUrl}/api/no-such-route`);
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('carries the not_found code and no server-written message', async () => {
      expect(await response.json()).toEqual({ code: 'not_found' });
    });
  });
});
