import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, createVenueFor } from '#test/seed.js';
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
    { method: 'POST', route: '/api/venues' },
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
      return app.request(method, path, {
        token,
        body: { name: 'The Anchor', timeZone: 'Europe/London' },
      });
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

  describe('POST /api/venues', () => {
    describe('when no token is sent', () => {
      beforeEach(async () => {
        response = await app.request('POST', '/api/venues', {
          body: { name: 'The Crown', timeZone: 'Europe/London' },
        });
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });

      it('creates no Venue', async () => {
        expect(await app.db.venue.count()).toBe(0);
      });
    });

    describe('when a User sends a name and timezone', () => {
      beforeEach(async () => {
        response = await app.request('POST', '/api/venues', {
          as: OWNER,
          body: { name: '  The Crown  ', timeZone: 'Europe/Dublin' },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the new Venue with the name trimmed', async () => {
        expect(await response.json()).toEqual({
          id: expect.any(String),
          name: 'The Crown',
          timeZone: 'Europe/Dublin',
          plan: 'free',
        });
      });

      it('makes the User its Owner', async () => {
        expect(
          await app.db.venueMember.findMany({ select: { userId: true, role: true } }),
        ).toEqual([{ userId: OWNER.id, role: 'owner' }]);
      });
    });

    describe('when the User already owns a Venue', () => {
      beforeEach(async () => {
        await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
        response = await app.request('POST', '/api/venues', {
          as: OWNER,
          body: { name: 'The Anchor', timeZone: 'Europe/London' },
        });
      });

      it('responds with 409', () => {
        expect(response.status).toBe(409);
      });

      it('carries the venue_already_exists code', async () => {
        expect(await response.json()).toEqual({ code: 'venue_already_exists' });
      });

      it('creates no second Venue', async () => {
        expect(await app.db.venue.findMany({ select: { name: true } })).toEqual([
          { name: 'The Crown' },
        ]);
      });
    });

    describe('when the timezone is not a real IANA timezone', () => {
      beforeEach(async () => {
        response = await app.request('POST', '/api/venues', {
          as: OWNER,
          body: { name: 'The Crown', timeZone: 'Europe/Atlantis' },
        });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });

      it('creates no Venue', async () => {
        expect(await app.db.venue.count()).toBe(0);
      });
    });

    describe('when the name is blank', () => {
      beforeEach(async () => {
        response = await app.request('POST', '/api/venues', {
          as: OWNER,
          body: { name: '   ', timeZone: 'Europe/London' },
        });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('creates no Venue', async () => {
        expect(await app.db.venue.count()).toBe(0);
      });
    });

    describe('when the body is not valid JSON', () => {
      beforeEach(async () => {
        response = await app.request('POST', '/api/venues', { as: OWNER, body: '{"name":' });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });
    });
  });
});
