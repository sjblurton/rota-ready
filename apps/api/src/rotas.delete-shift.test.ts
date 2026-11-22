import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createPublishedRotaFor,
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
const WEEK_START = '2026-11-16';
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const PAT = { name: 'Pat Other', role: 'Bar', email: 'pat@example.com', phone: null };
const MONDAY_9_TO_5 = {
  startsAt: '2026-11-16T09:00:00.000Z',
  endsAt: '2026-11-16T17:00:00.000Z',
};
const TUESDAY_9_TO_5 = {
  startsAt: '2026-11-17T09:00:00.000Z',
  endsAt: '2026-11-17T17:00:00.000Z',
};

function shiftPath(venue: { id: string }, weekStart: string, shift: { id: string }) {
  return `/api/venues/${venue.id}/rotas/${weekStart}/shifts/${shift.id}`;
}

function storedShiftIds(app: TestApp) {
  return app.db.shift.findMany({ select: { id: true }, orderBy: { startsAt: 'asc' } });
}

describe('DELETE /api/venues/:venueId/rotas/:weekStart/shifts/:shiftId', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };
  let sam: { id: string };
  let shift: { id: string };
  let tuesdayShift: { id: string };

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
    sam = await createActiveStaffMember(app.db, ownVenue, SAM);
    const rota = await createRotaFor(app.db, ownVenue, WEEK_START);
    shift = await createShift(app.db, rota, sam, MONDAY_9_TO_5);
    tuesdayShift = await createShift(app.db, rota, sam, TUESDAY_9_TO_5);
  });

  afterEach(() => app.close());

  describe('when no token is sent', () => {
    beforeEach(async () => {
      response = await app.request('DELETE', shiftPath(ownVenue, WEEK_START, shift));
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });

    it('keeps the Shift', async () => {
      expect(await storedShiftIds(app)).toEqual([{ id: shift.id }, { id: tuesdayShift.id }]);
    });
  });

  describe('when the Owner deletes a Shift', () => {
    beforeEach(async () => {
      response = await app.request('DELETE', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
      });
    });

    it('responds with 204', () => {
      expect(response.status).toBe(204);
    });

    it('removes only that Shift', async () => {
      expect(await storedShiftIds(app)).toEqual([{ id: tuesdayShift.id }]);
    });

    describe('when the Owner then loads the Rota', () => {
      beforeEach(async () => {
        response = await app.request('GET', `/api/venues/${ownVenue.id}/rotas/${WEEK_START}`, {
          as: OWNER,
        });
      });

      it('leaves the Shift out', async () => {
        expect(await response.json()).toMatchObject({
          shifts: [{ id: tuesdayShift.id }],
        });
      });
    });

    describe('when the Owner deletes it again', () => {
      beforeEach(async () => {
        response = await app.request('DELETE', shiftPath(ownVenue, WEEK_START, shift), {
          as: OWNER,
        });
      });

      it('responds with 404 and the not_found code', async () => {
        expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
      });
    });
  });

  describe('when the Owner deletes a Confirmed Shift in a Published Rota', () => {
    let published: { id: string };

    beforeEach(async () => {
      const publishedRota = await createPublishedRotaFor(app.db, ownVenue, '2026-11-23');
      published = await createShift(app.db, publishedRota, sam, {
        startsAt: '2026-11-23T09:00:00.000Z',
        endsAt: '2026-11-23T17:00:00.000Z',
      });
      await app.db.shift.update({
        where: { id: published.id },
        data: { response: 'confirmed', respondedAt: new Date('2026-11-20T10:00:00.000Z') },
      });
      response = await app.request('DELETE', shiftPath(ownVenue, '2026-11-23', published), {
        as: OWNER,
      });
    });

    it('responds with 204', () => {
      expect(response.status).toBe(204);
    });

    it('removes the Shift', async () => {
      expect(await app.db.shift.findUnique({ where: { id: published.id } })).toBeNull();
    });
  });

  describe("when the Shift is sent through another Week's URL", () => {
    beforeEach(async () => {
      response = await app.request('DELETE', shiftPath(ownVenue, '2026-11-23', shift), {
        as: OWNER,
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('keeps the Shift', async () => {
      expect(await storedShiftIds(app)).toEqual([{ id: shift.id }, { id: tuesdayShift.id }]);
    });
  });

  describe('when the Shift ID is not a UUID', () => {
    beforeEach(async () => {
      response = await app.request('DELETE', shiftPath(ownVenue, WEEK_START, { id: 'nope' }), {
        as: OWNER,
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the other venue has a Shift of its own', () => {
    let theirShift: { id: string };

    beforeEach(async () => {
      const pat = await createActiveStaffMember(app.db, otherVenue, PAT);
      const theirRota = await createRotaFor(app.db, otherVenue, WEEK_START);
      theirShift = await createShift(app.db, theirRota, pat, MONDAY_9_TO_5);
    });

    describe('when a member of another venue requests it', () => {
      beforeEach(async () => {
        response = await app.request('DELETE', shiftPath(otherVenue, WEEK_START, theirShift), {
          as: OWNER,
        });
      });

      it('responds with 404 and the not_found code', async () => {
        expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
      });

      it("keeps the other venue's Shift", async () => {
        expect(await app.db.shift.findUnique({ where: { id: theirShift.id } })).not.toBeNull();
      });
    });

    describe("when the other venue's Shift is sent through the Owner's venue", () => {
      beforeEach(async () => {
        response = await app.request('DELETE', shiftPath(ownVenue, WEEK_START, theirShift), {
          as: OWNER,
        });
      });

      it('responds with 404 and the not_found code', async () => {
        expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
      });

      it("keeps the other venue's Shift", async () => {
        expect(await app.db.shift.findUnique({ where: { id: theirShift.id } })).not.toBeNull();
      });
    });
  });
});
