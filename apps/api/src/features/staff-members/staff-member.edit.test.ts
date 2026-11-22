import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createUser,
  createVenueFor,
} from '#test/seed.js';
import { startTestApp, type TestApp } from '#test/test-app.js';

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
    { method: 'PATCH', route: '/staff-members/:staffMemberId' },
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
        body: { ...ALEX, name: 'Taken Over' },
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

    describe('when the Owner changes only the case of the email', () => {
      beforeEach(async () => {
        response = await app.request(
          'PATCH',
          `${staffMembersPath(ownVenue)}/${staffMemberId}`,
          { as: OWNER, body: { ...ALEX, email: 'Alex@Example.com' } },
        );
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('keeps the email lowercased', async () => {
        expect(await response.json()).toMatchObject({ email: ALEX.email });
      });
    });

    describe('when the Owner sends an invalid email', () => {
      beforeEach(async () => {
        response = await app.request(
          'PATCH',
          `${staffMembersPath(ownVenue)}/${staffMemberId}`,
          { as: OWNER, body: { ...ALEX, email: 'alex-at-example' } },
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
});
