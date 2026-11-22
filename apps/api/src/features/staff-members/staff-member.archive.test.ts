import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createRotaFor,
  createShift,
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

  describe('POST /api/venues/:venueId/staff-members/:staffMemberId/archive', () => {
    let staffMemberId: string;
    let samId: string;
    let rota: { id: string; venueId: string };

    beforeEach(async () => {
      staffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
      samId = (await createActiveStaffMember(app.db, ownVenue, SAM)).id;
      rota = await createRotaFor(app.db, ownVenue, '2026-11-16');
      app.setClock('2026-11-18T12:00:00.000Z');
    });

    function archive() {
      return app.request('POST', `${staffMembersPath(ownVenue)}/${staffMemberId}/archive`, {
        as: OWNER,
      });
    }

    function storedArchiveState() {
      return app.db.staffMember.findUnique({
        where: { id: staffMemberId },
        select: { archivedAt: true, email: true },
      });
    }

    describe('when the Owner archives a Staff Member', () => {
      beforeEach(async () => {
        response = await archive();
      });

      it('responds with 204', () => {
        expect(response.status).toBe(204);
      });

      it('keeps the Staff Member with an archived timestamp and clears their email', async () => {
        expect(await storedArchiveState()).toEqual({
          archivedAt: new Date('2026-11-18T12:00:00.000Z'),
          email: null,
        });
      });

      describe('when the Owner then lists Staff Members', () => {
        beforeEach(async () => {
          response = await app.request('GET', staffMembersPath(ownVenue), { as: OWNER });
        });

        it('leaves the archived Staff Member out', async () => {
          expect(await response.json()).toEqual([{ id: expect.any(String), ...SAM }]);
        });
      });

      describe('when the Owner then adds them again with the same email', () => {
        beforeEach(async () => {
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('responds with 201', () => {
          expect(response.status).toBe(201);
        });
      });
    });

    describe('when the Staff Member has a Shift on a Draft Rota that starts later', () => {
      let shiftId: string;

      beforeEach(async () => {
        shiftId = (
          await createShift(app.db, rota, { id: staffMemberId }, {
            startsAt: '2026-11-19T09:00:00.000Z',
            endsAt: '2026-11-19T17:00:00.000Z',
          })
        ).id;
        response = await archive();
      });

      it('responds with 409 and the staff_member_has_upcoming_shifts code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'staff_member_has_upcoming_shifts' },
        ]);
      });

      it('keeps them active with their email', async () => {
        expect(await storedArchiveState()).toEqual({ archivedAt: null, email: ALEX.email });
      });

      describe('when the Owner deletes the Shift and archives them again', () => {
        beforeEach(async () => {
          await app.request(
            'DELETE',
            `/api/venues/${ownVenue.id}/rotas/2026-11-16/shifts/${shiftId}`,
            { as: OWNER },
          );
          response = await archive();
        });

        it('responds with 204', () => {
          expect(response.status).toBe(204);
        });
      });
    });

    describe('when the Staff Member is partway through a Shift', () => {
      beforeEach(async () => {
        await createShift(app.db, rota, { id: staffMemberId }, {
          startsAt: '2026-11-18T09:00:00.000Z',
          endsAt: '2026-11-18T17:00:00.000Z',
        });
        response = await archive();
      });

      it('responds with 409 and the staff_member_has_upcoming_shifts code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'staff_member_has_upcoming_shifts' },
        ]);
      });
    });

    describe('when all of the Staff Member\'s Shifts have ended', () => {
      beforeEach(async () => {
        await createShift(app.db, rota, { id: staffMemberId }, {
          startsAt: '2026-11-17T09:00:00.000Z',
          endsAt: '2026-11-17T17:00:00.000Z',
        });
        response = await archive();
      });

      it('responds with 204', () => {
        expect(response.status).toBe(204);
      });

      it('archives them', async () => {
        expect(await storedArchiveState()).toEqual({
          archivedAt: new Date('2026-11-18T12:00:00.000Z'),
          email: null,
        });
      });
    });

    describe('when another Staff Member has a Shift that starts later', () => {
      beforeEach(async () => {
        await createShift(app.db, rota, { id: samId }, {
          startsAt: '2026-11-19T09:00:00.000Z',
          endsAt: '2026-11-19T17:00:00.000Z',
        });
        response = await archive();
      });

      it('responds with 204', () => {
        expect(response.status).toBe(204);
      });
    });
  });
});
