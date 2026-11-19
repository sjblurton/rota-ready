import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createUser,
  createVenueFor,
} from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};

const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' };

describe('/api/venues/:venueId/staff-members', () => {
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

  function staffMembersPath(venue: { id: string }) {
    return `/api/venues/${venue.id}/staff-members`;
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
      ownStaffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
      otherStaffMemberId = (
        await createActiveStaffMember(app.db, otherVenue, SAM)
      ).id;
    });

    function send(venue: { id: string }, staffMemberId: string, as?: typeof OWNER) {
      const path = `/api/venues/${venue.id}${route.replace(':staffMemberId', staffMemberId)}`;
      return app.request(method, path, {
        ...(as && { as }),
        body: method === 'GET' ? undefined : { ...ALEX, name: 'Taken Over' },
      });
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
    { method: 'PATCH', route: '/staff-members/:staffMemberId' },
    { method: 'POST', route: '/staff-members/:staffMemberId/archive' },
  ] as const)('$method $route', ({ method, route }) => {
    function send(staffMemberId: string) {
      const path = `/api/venues/${ownVenue.id}${route.replace(':staffMemberId', staffMemberId)}`;
      return app.request(method, path, { as: OWNER, body: ALEX });
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

  describe('GET /api/venues/:venueId/staff-members', () => {
    describe('when the venue has no Staff Members', () => {
      beforeEach(async () => {
        response = await app.request('GET', staffMembersPath(ownVenue), { as: OWNER });
      });

      it('returns an empty list', async () => {
        expect(await response.json()).toEqual([]);
      });
    });

    describe('when the venue has active and archived Staff Members, and another venue has its own', () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, otherVenue, { ...SAM, name: 'Other Venue Person' });
        await createActiveStaffMember(app.db, ownVenue, SAM);
        await createArchivedStaffMember(app.db, ownVenue, { ...ALEX, name: 'zoe Archived' });
        await createActiveStaffMember(app.db, ownVenue, { ...ALEX, name: 'alex smith' });
        response = await app.request('GET', staffMembersPath(ownVenue), { as: OWNER });
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
    describe('when the Owner adds a Staff Member with an email and a blank phone number', () => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), {
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
          await app.db.staffMember.findMany({
            select: { venueId: true, name: true, role: true, email: true, phone: true },
          }),
        ).toEqual([{ venueId: ownVenue.id, ...ALEX }]);
      });
    });

    describe('when the Owner adds a Staff Member with an email and a phone number', () => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: SAM,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the Staff Member with both', async () => {
        expect(await response.json()).toEqual({ id: expect.any(String), ...SAM });
      });
    });

    describe('when another active Staff Member in the venue already has the email', () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, ownVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: { ...SAM, email: 'ALEX@example.com' },
        });
      });

      it('responds with 409', () => {
        expect(response.status).toBe(409);
      });

      it('carries the staff_member_email_taken code', async () => {
        expect(await response.json()).toEqual({ code: 'staff_member_email_taken' });
      });

      it('creates no second Staff Member', async () => {
        expect(await app.db.staffMember.count()).toBe(1);
      });
    });

    describe('when only an archived Staff Member in the venue has the email', () => {
      beforeEach(async () => {
        await createArchivedStaffMember(app.db, ownVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: ALEX,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when a Staff Member in another venue has the email', () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, otherVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: ALEX,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe.each([
      { scenario: 'a blank email', body: { ...SAM, email: '  ' } },
      { scenario: 'no email', body: { name: SAM.name, role: SAM.role, phone: SAM.phone } },
      { scenario: 'a blank name', body: { ...ALEX, name: ' ' } },
      { scenario: 'a blank Role', body: { ...ALEX, role: '' } },
      { scenario: 'an invalid email', body: { ...ALEX, email: 'alex-at-example' } },
      { scenario: 'a phone number with letters', body: { ...SAM, phone: 'call me' } },
    ])('when the Owner sends $scenario', ({ body }) => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), { as: OWNER, body });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });

      it('creates no Staff Member', async () => {
        expect(await app.db.staffMember.count()).toBe(0);
      });
    });
  });

  describe('PATCH /api/venues/:venueId/staff-members/:staffMemberId', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      staffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
    });

    describe('when the Owner changes the Role and adds a phone number', () => {
      const edited = { ...ALEX, role: 'Floor', phone: '+44 7700 900456' };

      beforeEach(async () => {
        response = await app.request(
          'PATCH',
          `${staffMembersPath(ownVenue)}/${staffMemberId}`,
          { as: OWNER, body: edited },
        );
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the edited Staff Member', async () => {
        expect(await response.json()).toEqual({ id: staffMemberId, ...edited });
      });

      it('stores the changes', async () => {
        expect(
          await app.db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { name: true, role: true, email: true, phone: true },
          }),
        ).toEqual(edited);
      });
    });

    describe("when the Owner changes the email to another active Staff Member's", () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, ownVenue, SAM);
        response = await app.request(
          'PATCH',
          `${staffMembersPath(ownVenue)}/${staffMemberId}`,
          { as: OWNER, body: { ...ALEX, email: SAM.email } },
        );
      });

      it('responds with 409', () => {
        expect(response.status).toBe(409);
      });

      it('carries the staff_member_email_taken code', async () => {
        expect(await response.json()).toEqual({ code: 'staff_member_email_taken' });
      });

      it('keeps the old email', async () => {
        expect(
          await app.db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { email: true },
          }),
        ).toEqual({ email: ALEX.email });
      });
    });

    describe('when the Owner removes the email', () => {
      beforeEach(async () => {
        response = await app.request(
          'PATCH',
          `${staffMembersPath(ownVenue)}/${staffMemberId}`,
          { as: OWNER, body: { ...ALEX, email: '' } },
        );
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('keeps the old email', async () => {
        expect(
          await app.db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { email: true },
          }),
        ).toEqual({ email: ALEX.email });
      });
    });
  });

  describe('POST /api/venues/:venueId/staff-members/:staffMemberId/archive', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      staffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
      await createActiveStaffMember(app.db, ownVenue, SAM);
    });

    describe('when the Owner archives a Staff Member', () => {
      beforeEach(async () => {
        response = await app.request(
          'POST',
          `${staffMembersPath(ownVenue)}/${staffMemberId}/archive`,
          { as: OWNER },
        );
      });

      it('responds with 204', () => {
        expect(response.status).toBe(204);
      });

      it('keeps the Staff Member with an archived timestamp and clears their email', async () => {
        expect(
          await app.db.staffMember.findUnique({
            where: { id: staffMemberId },
            select: { archivedAt: true, email: true },
          }),
        ).toEqual({ archivedAt: expect.any(Date), email: null });
      });

      describe('when the Owner then lists Staff Members', () => {
        beforeEach(async () => {
          response = await app.request('GET', staffMembersPath(ownVenue), { as: OWNER });
        });

        it('leaves the archived Staff Member out', async () => {
          expect(await response.json()).toEqual([{ id: expect.any(String), ...SAM }]);
        });
      });
    });
  });
});
