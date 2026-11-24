import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createUser,
  createVenueFor,
} from '#test/seed.js';
import { startTestApp, type TestApp } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };

function staffLinkPath(venue: { id: string }, staffMember: { id: string }) {
  return `/api/venues/${venue.id}/staff-members/${staffMember.id}/staff-link`;
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('GET /api/venues/:venueId/staff-members/:staffMemberId/staff-link', () => {
  let app: TestApp;
  let response: Response;
  let venue: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
  });

  afterEach(() => app.close());

  describe('when the Owner opens the Staff Link of a Staff Member they added', () => {
    let sam: { id: string };
    let token: string;

    beforeEach(async () => {
      const added = await app.request('POST', `/api/venues/${venue.id}/staff-members`, {
        as: OWNER,
        body: SAM,
      });
      sam = (await added.json()) as { id: string };
      response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
      ({ token } = (await response.clone().json()) as { token: string });
    });

    it('responds with 200 and a URL-safe token of at least 32 bytes', () => {
      expect([response.status, Buffer.from(token, 'base64url').length >= 32]).toEqual([
        200,
        true,
      ]);
    });

    it('stores the SHA-256 hash of the token for lookup', async () => {
      expect(
        await app.db.staffMember.findUniqueOrThrow({
          where: { id: sam.id },
          select: { staffLinkTokenHash: true },
        }),
      ).toEqual({ staffLinkTokenHash: sha256Hex(token) });
    });

    it('never stores the plain token', async () => {
      const [row] = await app.db.$queryRaw<object[]>`SELECT * FROM staff_members`;
      expect(JSON.stringify(row)).not.toContain(token);
    });

    describe('when the Owner opens it again', () => {
      beforeEach(async () => {
        response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
      });

      it('returns the same token', async () => {
        expect(await response.json()).toEqual({ token });
      });
    });
  });

  describe('when the Staff Member was added before Staff Links existed', () => {
    let sam: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, venue, SAM);
    });

    describe('when the Owner opens their Staff Link', () => {
      let token: string;

      beforeEach(async () => {
        response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
        ({ token } = (await response.clone().json()) as { token: string });
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('stores a Staff Link for them', async () => {
        expect(
          await app.db.staffMember.findUniqueOrThrow({
            where: { id: sam.id },
            select: { staffLinkTokenHash: true },
          }),
        ).toEqual({ staffLinkTokenHash: sha256Hex(token) });
      });

      describe('when the Owner opens it again', () => {
        beforeEach(async () => {
          response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
        });

        it('returns the same token', async () => {
          expect(await response.json()).toEqual({ token });
        });
      });
    });
  });

  describe('when Sam is one of 20 active Staff Members, more than the Free plan lets the Venue add', () => {
    let sam: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, venue, SAM);
      for (let number = 2; number <= 20; number++) {
        await createActiveStaffMember(app.db, venue, {
          name: `Staff Member ${number}`,
          role: 'Bar',
          email: `staff-${number}@example.com`,
          phone: null,
        });
      }
      response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
    });

    it("returns Sam's Staff Link with 200", () => {
      expect(response.status).toBe(200);
    });
  });
});

describe('/api/venues/:venueId/staff-members', () => {
  const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
  const OTHER_OWNER = {
    id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
    email: 'other@example.com',
  };

  const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
  const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' };

  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    await createUser(app.db, OTHER_OWNER);
    ownVenue = await createVenueFor(app.db, OWNER, {
      name: 'The Crown',
      timeZone: 'Europe/London',
    });
    otherVenue = await createVenueFor(app.db, OTHER_OWNER, {
      name: 'The Anchor',
      timeZone: 'Europe/London',
    });
  });

  afterEach(() => app.close());

  describe.each([
    { method: 'GET', route: '/staff-members/:staffMemberId/staff-link' },
  ] as const)('$method $route', ({ method, route }) => {
    let ownStaffMemberId: string;
    let otherStaffMemberId: string;

    beforeEach(async () => {
      ownStaffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
      otherStaffMemberId = (
        await createActiveStaffMember(app.db, otherVenue, SAM)
      ).id;
    });

    function send(venue: { id: string }, staffMemberId: string, as?: typeof OWNER) {
      const path = `/api/venues/${venue.id}${route.replace(':staffMemberId', staffMemberId)}`;
      return app.request(method, path, { ...(as && { as }) });
    }

    describe('when no token is sent', () => {
      beforeEach(async () => {
        response = await send(ownVenue, ownStaffMemberId);
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when a member of another venue requests it', () => {
      beforeEach(async () => {
        response = await send(otherVenue, otherStaffMemberId, OWNER);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });

      it('carries the not_found code', async () => {
        expect(await response.json()).toEqual({ code: 'not_found' });
      });

      it("leaves the other venue's Staff Members unchanged", async () => {
        expect(
          await app.db.staffMember.findMany({
            where: { venueId: otherVenue.id },
            select: { name: true, archivedAt: true },
          }),
        ).toEqual([{ name: SAM.name, archivedAt: null }]);
      });
    });
  });

  describe.each([
    { method: 'GET', route: '/staff-members/:staffMemberId/staff-link' },
  ] as const)('$method $route', ({ method, route }) => {
    function send(staffMemberId: string) {
      const path = `/api/venues/${ownVenue.id}${route.replace(':staffMemberId', staffMemberId)}`;
      return app.request(method, path, { as: OWNER });
    }

    describe("when the Owner sends another venue's Staff Member ID through their own venue's URL", () => {
      let otherStaffMemberId: string;

      beforeEach(async () => {
        otherStaffMemberId = (
          await createActiveStaffMember(app.db, otherVenue, SAM)
        ).id;
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
          await app.db.staffMember.findUnique({
            where: { id: otherStaffMemberId },
            select: { name: true, email: true, archivedAt: true },
          }),
        ).toEqual({ name: SAM.name, email: SAM.email, archivedAt: null });
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
        const archived = await createArchivedStaffMember(app.db, ownVenue, ALEX);
        response = await send(archived.id);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });
    });
  });
});
