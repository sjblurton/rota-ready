import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '#test/test-app.js';

const UNREACHABLE_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:1/postgres';
const USER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };

describe('API error responses', () => {
  let app: TestApp;
  let response: Response;

  afterEach(() => app.close());

  describe('when a route that does not exist is requested', () => {
    beforeEach(async () => {
      app = await startTestApp();
      response = await app.request('GET', '/api/no-such-route');
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
      app = await startTestApp({ databaseUrl: UNREACHABLE_DATABASE_URL });
      response = await app.request('GET', '/api/me', { as: USER });
    });

    it('responds with 500', () => {
      expect(response.status).toBe(500);
    });

    it('carries only the internal_error code, with no message or stack', async () => {
      expect(await response.json()).toEqual({ code: 'internal_error' });
    });
  });
});
