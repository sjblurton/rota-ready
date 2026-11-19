import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser } from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const USER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };

describe('/api/me', () => {
  let app: TestApp;
  let response: Response;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(() => app.close());

  function request(method: 'GET' | 'PUT', token?: string) {
    return app.request(method, '/api/me', token ? { token } : {});
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
        response = await request('GET', await app.signTokenWithAnotherKey(USER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token has expired', () => {
      beforeEach(async () => {
        response = await request('GET', await app.signExpiredToken(USER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token was issued by another issuer', () => {
      beforeEach(async () => {
        response = await request(
          'GET',
          await app.signToken(USER, { issuer: 'http://elsewhere.test/auth/v1' }),
        );
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token is valid but no User row exists', () => {
      beforeEach(async () => {
        response = await request('GET', await app.signToken(USER));
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
        await createUser(app.db, USER);
        response = await request('GET', await app.signToken(USER));
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the User', async () => {
        expect(await response.json()).toEqual(USER);
      });
    });
  });

  describe('PUT', () => {
    describe('when the token is signed with the wrong key', () => {
      beforeEach(async () => {
        response = await request('PUT', await app.signTokenWithAnotherKey(USER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });

      it('creates no User', async () => {
        expect(await app.db.user.count()).toBe(0);
      });
    });

    describe('when the token is valid and no User row exists', () => {
      beforeEach(async () => {
        response = await request('PUT', await app.signToken(USER));
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the new User', async () => {
        expect(await response.json()).toEqual(USER);
      });

      it('stores the User keyed by the token subject', async () => {
        expect(await app.db.user.findMany({ select: { id: true, email: true } })).toEqual([
          USER,
        ]);
      });

      describe('when it is called again', () => {
        beforeEach(async () => {
          response = await request('PUT', await app.signToken(USER));
        });

        it('returns the same User', async () => {
          expect(await response.json()).toEqual(USER);
        });

        it('still stores only one User', async () => {
          expect(await app.db.user.count()).toBe(1);
        });
      });
    });

    describe('when the User already exists with an older email address', () => {
      beforeEach(async () => {
        await createUser(app.db, { id: USER.id, email: 'old@example.com' });
        response = await request('PUT', await app.signToken(USER));
      });

      it('returns the email address from the token', async () => {
        expect(await response.json()).toEqual(USER);
      });

      it('stores the email address from the token', async () => {
        expect(await app.db.user.findUnique({ where: { id: USER.id } })).toMatchObject({
          email: USER.email,
        });
      });
    });
  });
});
