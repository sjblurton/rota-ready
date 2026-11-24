import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plan } from '@rota-ready/shared';
import { createUser, createVenueFor, moveVenueToPro } from '#test/seed.js';
import { startTestApp, type TestApp } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};
const USER_WITHOUT_ROW = {
  id: '0b7e4a2c-9d3f-4e1a-b5c6-8f2d1e0a9b3c',
  email: 'nobody@example.com',
};

describe('/api/venues', () => {
  let app: TestApp;
  let response: Response;

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    await createUser(app.db, OTHER_OWNER);
  });

  afterEach(() => app.close());

  describe.each([
    { method: 'GET', route: '/api/venues/:venueId' },
  ] as const)('$method $route auth', ({ method, route }) => {
    let path: string;

    beforeEach(async () => {
      const venue = await createVenueFor(app.db, OWNER, {
        name: 'The Crown',
        timeZone: 'Europe/London',
      });
      path = route.replace(':venueId', venue.id);
    });

    function send(token: string) {
      return app.request(method, path, { token });
    }

    describe('when the token is signed with the wrong key', () => {
      beforeEach(async () => {
        response = await send(await app.signTokenWithAnotherKey(OWNER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token has expired', () => {
      beforeEach(async () => {
        response = await send(await app.signExpiredToken(OWNER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token is valid but no User row exists', () => {
      beforeEach(async () => {
        response = await send(await app.signToken(USER_WITHOUT_ROW));
      });

      it('responds with 403', () => {
        expect(response.status).toBe(403);
      });

      it('carries the forbidden code', async () => {
        expect(await response.json()).toEqual({ code: 'forbidden' });
      });
    });
  });

  describe('venue-scoped routes', () => {
    let ownVenueId: string;
    let otherVenueId: string;

    beforeEach(async () => {
      ownVenueId = (
        await createVenueFor(app.db, OWNER, {
          name: 'The Crown',
          timeZone: 'Europe/London',
          plan: plan.free,
        })
      ).id;
      otherVenueId = (
        await createVenueFor(app.db, OTHER_OWNER, { name: 'The Anchor', timeZone: 'Europe/London' })
      ).id;
    });

    describe('GET /api/venues/:venueId', () => {
      describe('when no token is sent', () => {
        beforeEach(async () => {
          response = await app.request('GET', `/api/venues/${ownVenueId}`);
        });

        it('responds with 401', () => {
          expect(response.status).toBe(401);
        });
      });

      describe('when the Owner requests their Venue', () => {
        beforeEach(async () => {
          response = await app.request('GET', `/api/venues/${ownVenueId}`, { as: OWNER });
        });

        it('responds with 200', () => {
          expect(response.status).toBe(200);
        });

        it('returns the Venue', async () => {
          expect(await response.json()).toEqual({
            id: ownVenueId,
            name: 'The Crown',
            timeZone: 'Europe/London',
            plan: 'free',
          });
        });
      });

      describe('when the Owner requests their Venue on Pro', () => {
        beforeEach(async () => {
          await moveVenueToPro(app.db, { id: ownVenueId });
          response = await app.request('GET', `/api/venues/${ownVenueId}`, { as: OWNER });
        });

        it('returns the Venue with the Pro Plan', async () => {
          expect(await response.json()).toMatchObject({ id: ownVenueId, plan: 'pro' });
        });
      });

      describe('when a member of another venue requests it', () => {
        beforeEach(async () => {
          response = await app.request('GET', `/api/venues/${otherVenueId}`, { as: OWNER });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });

        it('carries the not_found code', async () => {
          expect(await response.json()).toEqual({ code: 'not_found' });
        });
      });

      describe('when the Venue does not exist', () => {
        beforeEach(async () => {
          response = await app.request('GET', `/api/venues/${randomUUID()}`, { as: OWNER });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });

        it('carries the not_found code', async () => {
          expect(await response.json()).toEqual({ code: 'not_found' });
        });
      });

      describe('when the venue ID is not a UUID', () => {
        beforeEach(async () => {
          response = await app.request('GET', '/api/venues/not-a-uuid', { as: OWNER });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });
      });
    });
  });
});
