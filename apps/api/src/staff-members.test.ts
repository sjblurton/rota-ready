import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
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

const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: null, phone: '07700 900123' };

describe('/api/venues/:venueId/staff-members', () => {
  let db: Db;
  let server: Server;
  let baseUrl: string;
  let signingKey: CryptoKey;
  let response: Response;
  let ownVenueId: string;
  let otherVenueId: string;

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
    ownVenueId = (await createVenueFor(OWNER, 'The Crown')).id;
    otherVenueId = (await createVenueFor(OTHER_OWNER, 'The Anchor')).id;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  function signToken(user: { id: string; email: string }) {
    return new SignJWT({ email: user.email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(signingKey);
  }

  async function request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    { as, body }: { as?: { id: string; email: string } | undefined; body?: object | undefined } = {},
  ) {
    const headers: Record<string, string> = {};
    if (as) headers.authorization = `Bearer ${await signToken(as)}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
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

  function createStaffMember(
    venueId: string,
    details: { name: string; role: string; email: string | null; phone: string | null },
    { archivedAt = null }: { archivedAt?: Date | null } = {},
  ) {
    return db.staffMember.create({ data: { ...details, venueId, archivedAt } });
  }

  function staffMembersPath(venueId: string) {
    return `/api/venues/${venueId}/staff-members`;
  }

  describe.each([
    { method: 'GET', route: '/staff-members' },
    { method: 'POST', route: '/staff-members' },
    { method: 'PATCH', route: '/staff-members/:staffMemberId' },
    { method: 'POST', route: '/staff-members/:staffMemberId/archive' },
  ] as const)('$method $route', ({ method, route }) => {
    let ownStaffMemberId: string;
    let otherStaffMemberId: string;

    beforeEach(async () => {
      ownStaffMemberId = (await createStaffMember(ownVenueId, ALEX)).id;
      otherStaffMemberId = (await createStaffMember(otherVenueId, SAM)).id;
    });

    function send(venueId: string, staffMemberId: string, as?: typeof OWNER) {
      const path = `/api/venues/${venueId}${route.replace(':staffMemberId', staffMemberId)}`;
      return request(method, path, {
        as,
        body: method === 'GET' ? undefined : { ...ALEX, name: 'Taken Over' },
      });
    }

    describe('when no token is sent', () => {
      beforeEach(async () => {
        response = await send(ownVenueId, ownStaffMemberId);
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when a member of another venue requests it', () => {
      beforeEach(async () => {
        response = await send(otherVenueId, otherStaffMemberId, OWNER);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });

      it('carries the not_found code', async () => {
        expect(await response.json()).toEqual({ code: 'not_found' });
      });

      it("leaves the other venue's Staff Members unchanged", async () => {
        expect(
          await db.staffMember.findMany({
            where: { venueId: otherVenueId },
            select: { name: true, archivedAt: true },
          }),
        ).toEqual([{ name: SAM.name, archivedAt: null }]);
      });
    });
  });

  describe.each([
    { method: 'PATCH', route: '/staff-members/:staffMemberId' },
    { method: 'POST', route: '/staff-members/:staffMemberId/archive' },
  ] as const)('$method $route', ({ method, route }) => {
    function send(staffMemberId: string) {
      const path = `/api/venues/${ownVenueId}${route.replace(':staffMemberId', staffMemberId)}`;
      return request(method, path, { as: OWNER, body: ALEX });
    }

    describe("when the Owner sends another venue's Staff Member ID through their own venue's URL", () => {
      let otherStaffMemberId: string;

      beforeEach(async () => {
        otherStaffMemberId = (await createStaffMember(otherVenueId, SAM)).id;
        response = await send(otherStaffMemberId);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });

      it('carries the not_found code', async () => {
        expect(await response.json()).toEqual({ code: 'not_found' });
      });

      it('leaves that Staff Member unchanged', async () => {
        expect(
          await db.staffMember.findUnique({
            where: { id: otherStaffMemberId },
            select: { name: true, email: true, archivedAt: true },
          }),
        ).toEqual({ name: SAM.name, email: null, archivedAt: null });
      });
    });

    describe('when the Staff Member does not exist', () => {
      beforeEach(async () => {
        response = await send(randomUUID());
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });
    });

    describe('when the Staff Member ID is not a UUID', () => {
      beforeEach(async () => {
        response = await send('not-a-uuid');
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });
    });

    describe('when the Staff Member is archived', () => {
      beforeEach(async () => {
        const archived = await createStaffMember(ownVenueId, ALEX, { archivedAt: new Date() });
        response = await send(archived.id);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });
    });
  });

  describe('GET /api/venues/:venueId/staff-members', () => {
    describe('when the venue has no Staff Members', () => {
      beforeEach(async () => {
        response = await request('GET', staffMembersPath(ownVenueId), { as: OWNER });
      });

      it('returns an empty list', async () => {
        expect(await response.json()).toEqual([]);
      });
    });

    describe('when the venue has active and archived Staff Members, and another venue has its own', () => {
      beforeEach(async () => {
        await createStaffMember(otherVenueId, { ...SAM, name: 'Other Venue Person' });
        await createStaffMember(ownVenueId, SAM);
        await createStaffMember(ownVenueId, { ...ALEX, name: 'zoe Archived' }, {
          archivedAt: new Date(),
        });
        await createStaffMember(ownVenueId, { ...ALEX, name: 'alex smith' });
        response = await request('GET', staffMembersPath(ownVenueId), { as: OWNER });
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns only the active Staff Members, sorted by name ignoring case', async () => {
        expect(await response.json()).toEqual([
          { id: expect.any(String), ...ALEX, name: 'alex smith' },
          { id: expect.any(String), ...SAM },
        ]);
      });
    });
  });

  describe('POST /api/venues/:venueId/staff-members', () => {
    describe('when the Owner adds a Staff Member with only an email', () => {
      beforeEach(async () => {
        response = await request('POST', staffMembersPath(ownVenueId), {
          as: OWNER,
          body: { name: '  Alex Smith ', role: ' Bar ', email: ' Alex@Example.com ', phone: '' },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the Staff Member trimmed, with the email lowercased and no phone', async () => {
        expect(await response.json()).toEqual({ id: expect.any(String), ...ALEX });
      });

      it('stores the Staff Member in the venue', async () => {
        expect(
          await db.staffMember.findMany({
            select: { venueId: true, name: true, role: true, email: true, phone: true },
          }),
        ).toEqual([{ venueId: ownVenueId, ...ALEX }]);
      });
    });

    describe('when the Owner adds a Staff Member with only a phone number', () => {
      beforeEach(async () => {
        response = await request('POST', staffMembersPath(ownVenueId), {
          as: OWNER,
          body: { name: SAM.name, role: SAM.role, phone: SAM.phone },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the Staff Member with no email', async () => {
        expect(await response.json()).toEqual({ id: expect.any(String), ...SAM });
      });
    });

    describe.each([
      { scenario: 'neither an email nor a phone number', body: { ...ALEX, email: '  ' } },
      { scenario: 'a blank name', body: { ...ALEX, name: ' ' } },
      { scenario: 'a blank Role', body: { ...ALEX, role: '' } },
      { scenario: 'an invalid email', body: { ...ALEX, email: 'alex-at-example' } },
      { scenario: 'a phone number with letters', body: { ...SAM, phone: 'call me' } },
    ])('when the Owner sends $scenario', ({ body }) => {
      beforeEach(async () => {
        response = await request('POST', staffMembersPath(ownVenueId), { as: OWNER, body });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });

      it('creates no Staff Member', async () => {
        expect(await db.staffMember.count()).toBe(0);
      });
    });
  });

  describe('PATCH /api/venues/:venueId/staff-members/:staffMemberId', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      staffMemberId = (await createStaffMember(ownVenueId, ALEX)).id;
    });

    describe('when the Owner swaps the email for a phone number and changes the Role', () => {
      const edited = { ...ALEX, role: 'Floor', email: null, phone: '+44 7700 900456' };

      beforeEach(async () => {
        response = await request('PATCH', `${staffMembersPath(ownVenueId)}/${staffMemberId}`, {
          as: OWNER,
          body: { ...edited, email: '' },
        });
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the edited Staff Member', async () => {
        expect(await response.json()).toEqual({ id: staffMemberId, ...edited });
      });

      it('stores the changes', async () => {
        expect(
          await db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { name: true, role: true, email: true, phone: true },
          }),
        ).toEqual(edited);
      });
    });

    describe('when the Owner removes both the email and the phone number', () => {
      beforeEach(async () => {
        response = await request('PATCH', `${staffMembersPath(ownVenueId)}/${staffMemberId}`, {
          as: OWNER,
          body: { ...ALEX, email: '', phone: '' },
        });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('keeps the old email', async () => {
        expect(
          await db.staffMember.findUnique({ where: { id: staffMemberId }, select: { email: true } }),
        ).toEqual({ email: ALEX.email });
      });
    });
  });

  describe('POST /api/venues/:venueId/staff-members/:staffMemberId/archive', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      staffMemberId = (await createStaffMember(ownVenueId, ALEX)).id;
      await createStaffMember(ownVenueId, SAM);
    });

    describe('when the Owner archives a Staff Member', () => {
      beforeEach(async () => {
        response = await request(
          'POST',
          `${staffMembersPath(ownVenueId)}/${staffMemberId}/archive`,
          { as: OWNER },
        );
      });

      it('responds with 204', () => {
        expect(response.status).toBe(204);
      });

      it('keeps the Staff Member with an archived timestamp', async () => {
        expect(
          await db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { archivedAt: true },
          }),
        ).toEqual({ archivedAt: expect.any(Date) });
      });

      describe('when the Owner then lists Staff Members', () => {
        beforeEach(async () => {
          response = await request('GET', staffMembersPath(ownVenueId), { as: OWNER });
        });

        it('leaves the archived Staff Member out', async () => {
          expect(await response.json()).toEqual([{ id: expect.any(String), ...SAM }]);
        });
      });
    });
  });
});
