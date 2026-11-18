import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from 'jose';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createApp } from './app.js';
import { createDb, type Db } from './db.js';

const ISSUER = 'http://auth.test/auth/v1';
const KEY_ID = 'test-key';
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
  let db: Db;
  let server: Server;
  let baseUrl: string;
  let signingKey: CryptoKey;
  let response: Response;

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    signingKey = privateKey;
    const publicJwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'ES256' };
    db = createDb(inject('databaseUrl'));
    server = createApp({
      db,
      authConfig: {
        keys: createLocalJWKSet({ keys: [publicJwk] }),
        issuer: ISSUER,
        audience: 'authenticated',
      },
    }).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
    await db.user.createMany({ data: [OWNER, OTHER_OWNER] });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  function signToken(
    user: { id: string; email: string },
    { key = signingKey, expiresAt = '1h' }: { key?: CryptoKey; expiresAt?: string | number } = {},
  ) {
    return new SignJWT({ email: user.email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(key);
  }

  async function signTokenWithAnotherKey(user: { id: string; email: string }) {
    const { privateKey } = await generateKeyPair('ES256');
    return signToken(user, { key: privateKey });
  }

  function signExpiredToken(user: { id: string; email: string }) {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    return signToken(user, { expiresAt: oneMinuteAgo });
  }

  async function request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    {
      as,
      token,
      body,
    }: {
      as?: { id: string; email: string };
      token?: string;
      body?: string | object | undefined;
    } = {},
  ) {
    const headers: Record<string, string> = {};
    const bearer = token ?? (as && (await signToken(as)));
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, init);
  }

  function createVenueFor(user: { id: string }, name: string) {
    return db.venue.create({
      data: {
        name,
        timeZone: 'Europe/London',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
  }

  describe.each([
    { method: 'POST', route: '/api/venues' },
    { method: 'GET', route: '/api/venues' },
    { method: 'GET', route: '/api/venues/:venueId' },
    { method: 'PATCH', route: '/api/venues/:venueId' },
  ] as const)('$method $route auth', ({ method, route }) => {
    let path: string;

    beforeEach(async () => {
      const venue = await createVenueFor(OWNER, 'The Crown');
      path = route.replace(':venueId', venue.id);
    });

    function send(token: string) {
      return request(method, path, {
        token,
        body: method === 'GET' ? undefined : { name: 'The Anchor', timeZone: 'Europe/London' },
      });
    }

    describe('when the token is signed with the wrong key', () => {
      beforeEach(async () => {
        response = await send(await signTokenWithAnotherKey(OWNER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token has expired', () => {
      beforeEach(async () => {
        response = await send(await signExpiredToken(OWNER));
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when the token is valid but no User row exists', () => {
      beforeEach(async () => {
        response = await send(await signToken(USER_WITHOUT_ROW));
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
        response = await request('POST', '/api/venues', {
          body: { name: 'The Crown', timeZone: 'Europe/London' },
        });
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });

      it('creates no Venue', async () => {
        expect(await db.venue.count()).toBe(0);
      });
    });

    describe('when a User sends a name and timezone', () => {
      beforeEach(async () => {
        response = await request('POST', '/api/venues', {
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
        });
      });

      it('makes the User its Owner', async () => {
        expect(
          await db.venueMember.findMany({ select: { userId: true, role: true } }),
        ).toEqual([{ userId: OWNER.id, role: 'owner' }]);
      });
    });

    describe('when the User already owns a Venue', () => {
      beforeEach(async () => {
        await createVenueFor(OWNER, 'The Crown');
        response = await request('POST', '/api/venues', {
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
        expect(await db.venue.findMany({ select: { name: true } })).toEqual([
          { name: 'The Crown' },
        ]);
      });
    });

    describe('when the timezone is not a real IANA timezone', () => {
      beforeEach(async () => {
        response = await request('POST', '/api/venues', {
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
        expect(await db.venue.count()).toBe(0);
      });
    });

    describe('when the name is blank', () => {
      beforeEach(async () => {
        response = await request('POST', '/api/venues', {
          as: OWNER,
          body: { name: '   ', timeZone: 'Europe/London' },
        });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('creates no Venue', async () => {
        expect(await db.venue.count()).toBe(0);
      });
    });

    describe('when the body is not valid JSON', () => {
      beforeEach(async () => {
        response = await request('POST', '/api/venues', { as: OWNER, body: '{"name":' });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });
    });
  });

  describe('GET /api/venues', () => {
    describe('when the User has no Venue', () => {
      beforeEach(async () => {
        response = await request('GET', '/api/venues', { as: OWNER });
      });

      it('returns an empty list', async () => {
        expect(await response.json()).toEqual([]);
      });
    });

    describe('when the User and another User each have a Venue', () => {
      beforeEach(async () => {
        await createVenueFor(OWNER, 'The Crown');
        await createVenueFor(OTHER_OWNER, 'The Anchor');
        response = await request('GET', '/api/venues', { as: OWNER });
      });

      it('returns only the Venue the User is a member of', async () => {
        expect(await response.json()).toEqual([
          { id: expect.any(String), name: 'The Crown', timeZone: 'Europe/London' },
        ]);
      });
    });
  });

  describe('venue-scoped routes', () => {
    let ownVenueId: string;
    let otherVenueId: string;

    beforeEach(async () => {
      ownVenueId = (await createVenueFor(OWNER, 'The Crown')).id;
      otherVenueId = (await createVenueFor(OTHER_OWNER, 'The Anchor')).id;
    });

    describe('GET /api/venues/:venueId', () => {
      describe('when no token is sent', () => {
        beforeEach(async () => {
          response = await request('GET', `/api/venues/${ownVenueId}`);
        });

        it('responds with 401', () => {
          expect(response.status).toBe(401);
        });
      });

      describe('when the Owner requests their Venue', () => {
        beforeEach(async () => {
          response = await request('GET', `/api/venues/${ownVenueId}`, { as: OWNER });
        });

        it('responds with 200', () => {
          expect(response.status).toBe(200);
        });

        it('returns the Venue', async () => {
          expect(await response.json()).toEqual({
            id: ownVenueId,
            name: 'The Crown',
            timeZone: 'Europe/London',
          });
        });
      });

      describe('when a member of another venue requests it', () => {
        beforeEach(async () => {
          response = await request('GET', `/api/venues/${otherVenueId}`, { as: OWNER });
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
          response = await request('GET', `/api/venues/${randomUUID()}`, { as: OWNER });
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
          response = await request('GET', '/api/venues/not-a-uuid', { as: OWNER });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });
      });
    });

    describe('PATCH /api/venues/:venueId', () => {
      describe('when the Owner renames their Venue', () => {
        beforeEach(async () => {
          response = await request('PATCH', `/api/venues/${ownVenueId}`, {
            as: OWNER,
            body: { name: 'The Rose & Crown' },
          });
        });

        it('responds with 200', () => {
          expect(response.status).toBe(200);
        });

        it('returns the renamed Venue', async () => {
          expect(await response.json()).toEqual({
            id: ownVenueId,
            name: 'The Rose & Crown',
            timeZone: 'Europe/London',
          });
        });

        it('stores the new name', async () => {
          expect(await db.venue.findUnique({ where: { id: ownVenueId } })).toMatchObject({
            name: 'The Rose & Crown',
          });
        });
      });

      describe('when the new name is blank', () => {
        beforeEach(async () => {
          response = await request('PATCH', `/api/venues/${ownVenueId}`, {
            as: OWNER,
            body: { name: '' },
          });
        });

        it('responds with 400', () => {
          expect(response.status).toBe(400);
        });

        it('keeps the old name', async () => {
          expect(await db.venue.findUnique({ where: { id: ownVenueId } })).toMatchObject({
            name: 'The Crown',
          });
        });
      });

      describe('when a member of another venue requests it', () => {
        beforeEach(async () => {
          response = await request('PATCH', `/api/venues/${otherVenueId}`, {
            as: OWNER,
            body: { name: 'Taken over' },
          });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });

        it('carries the not_found code', async () => {
          expect(await response.json()).toEqual({ code: 'not_found' });
        });

        it('leaves the other Venue unchanged', async () => {
          expect(await db.venue.findUnique({ where: { id: otherVenueId } })).toMatchObject({
            name: 'The Anchor',
          });
        });
      });

      describe('when the Venue does not exist', () => {
        beforeEach(async () => {
          response = await request('PATCH', `/api/venues/${randomUUID()}`, {
            as: OWNER,
            body: { name: 'Ghost' },
          });
        });

        it('responds with 404', () => {
          expect(response.status).toBe(404);
        });

        it('carries the not_found code', async () => {
          expect(await response.json()).toEqual({ code: 'not_found' });
        });
      });
    });
  });
});
