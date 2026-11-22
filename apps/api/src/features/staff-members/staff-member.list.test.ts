import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createUser,
  createVenueFor,
} from '../../../test/seed.js';
import { startTestApp, type TestApp } from '../../../test/test-app.js';

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
});
