import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
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

function rotaPath(venue: { id: string }, weekStart: string) {
  return `/api/venues/${venue.id}/rotas/${weekStart}`;
}

describe('GET /api/venues/:venueId/rotas/:weekStart', () => {
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

  describe('when no token is sent', () => {
    beforeEach(async () => {
      response = await app.request('GET', rotaPath(ownVenue, WEEK_START));
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      response = await app.request('GET', rotaPath(otherVenue, WEEK_START), { as: OWNER });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('carries the not_found code', async () => {
      expect(await response.json()).toEqual({ code: 'not_found' });
    });

    it('creates no Rota for the other venue', async () => {
      expect(await app.db.rota.count()).toBe(0);
    });
  });

  describe.each([
    { scenario: 'a Tuesday', weekStart: '2026-11-17' },
    { scenario: 'a date that does not exist', weekStart: '2026-02-30' },
    { scenario: 'not a date', weekStart: 'this-week' },
  ])('when the Week start is $scenario', ({ weekStart }) => {
    beforeEach(async () => {
      response = await app.request('GET', rotaPath(ownVenue, weekStart), { as: OWNER });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('creates no Rota', async () => {
      expect(await app.db.rota.count()).toBe(0);
    });
  });

  describe('when the Owner opens a Week for the first time from two tabs at once', () => {
    let responses: Response[];

    beforeEach(async () => {
      responses = await Promise.all([
        app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER }),
        app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER }),
      ]);
    });

    it('responds with 200 to both', () => {
      expect(responses.map((each) => each.status)).toEqual([200, 200]);
    });

    it('stores only one Rota', async () => {
      expect(await app.db.rota.count()).toBe(1);
    });
  });

  describe('when the Owner opens a Week for the first time', () => {
    beforeEach(async () => {
      response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('returns a Draft Rota for that Week with no Shifts', async () => {
      expect(await response.json()).toEqual({
        weekStart: WEEK_START,
        status: 'draft',
        shifts: [],
      });
    });

    it('stores the Rota for the venue', async () => {
      expect(
        await app.db.rota.findMany({ select: { venueId: true, status: true } }),
      ).toEqual([{ venueId: ownVenue.id, status: 'draft' }]);
    });

    describe('when the Owner opens the same Week again', () => {
      beforeEach(async () => {
        response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
      });

      it('returns the same Rota', async () => {
        expect(await response.json()).toMatchObject({ weekStart: WEEK_START, status: 'draft' });
      });

      it('still stores only one Rota', async () => {
        expect(await app.db.rota.count()).toBe(1);
      });
    });
  });

  describe('when the Week already has Shifts', () => {
    let lateShift: { id: string };
    let earlyShift: { id: string };
    let nextWeekShift: { id: string };
    let sam: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      const rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      const nextRota = await createRotaFor(app.db, ownVenue, '2026-11-23');
      lateShift = await createShift(app.db, rota, sam, {
        startsAt: '2026-11-22T20:00:00.000Z',
        endsAt: '2026-11-23T02:00:00.000Z',
      });
      earlyShift = await createShift(app.db, rota, sam, {
        startsAt: '2026-11-16T09:00:00.000Z',
        endsAt: '2026-11-16T17:00:00.000Z',
      });
      nextWeekShift = await createShift(app.db, nextRota, sam, {
        startsAt: '2026-11-23T09:00:00.000Z',
        endsAt: '2026-11-23T17:00:00.000Z',
      });
      response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
    });

    it("returns that Week's Shifts, earliest first", async () => {
      expect(await response.json()).toMatchObject({
        shifts: [
          {
            id: earlyShift.id,
            staffMemberId: sam.id,
            startsAt: '2026-11-16T09:00:00.000Z',
            endsAt: '2026-11-16T17:00:00.000Z',
          },
          {
            id: lateShift.id,
            staffMemberId: sam.id,
            startsAt: '2026-11-22T20:00:00.000Z',
            endsAt: '2026-11-23T02:00:00.000Z',
          },
        ],
      });
    });

    it("leaves out the next Week's Shift", async () => {
      expect(await response.json()).not.toMatchObject({
        shifts: expect.arrayContaining([expect.objectContaining({ id: nextWeekShift.id })]),
      });
    });

    describe('when the Owner opens it at 09:00 on Monday', () => {
      beforeEach(async () => {
        app.setClock('2026-11-16T09:00:00.000Z');
        response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
      });

      it("marks Monday's Shift as started and Sunday's as not", async () => {
        expect(await response.json()).toMatchObject({
          shifts: [
            { id: earlyShift.id, started: true },
            { id: lateShift.id, started: false },
          ],
        });
      });
    });
  });
});
