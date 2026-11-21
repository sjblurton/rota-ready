import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createPublishedRotaFor,
  createRotaFor,
  createShift,
  createUser,
  createVenueFor,
} from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};
const WEEK_START = '2026-11-16';
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const MONDAY_9_TO_5 = {
  startsAt: '2026-11-16T09:00:00.000Z',
  endsAt: '2026-11-16T17:00:00.000Z',
};

function shiftPath(venue: { id: string }, weekStart: string, shift: { id: string }) {
  return `/api/venues/${venue.id}/rotas/${weekStart}/shifts/${shift.id}`;
}

function storedShifts(app: TestApp) {
  return app.db.shift.findMany({
    select: { id: true, staffMemberId: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: 'asc' },
  });
}

describe('PATCH /api/venues/:venueId/rotas/:weekStart/shifts/:shiftId', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };
  let sam: { id: string };
  let jo: { id: string };
  let rota: { id: string; venueId: string };
  let shift: { id: string };

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
    jo = await createActiveStaffMember(app.db, ownVenue, JO);
    rota = await createRotaFor(app.db, ownVenue, WEEK_START);
    shift = await createShift(app.db, rota, sam, MONDAY_9_TO_5);
  });

  afterEach(() => app.close());

  describe('when no token is sent', () => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        body: { staffMemberId: jo.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when the Owner moves the Shift to another Staff Member and another day', () => {
    beforeEach(async () => {
      app.setClock('2026-11-16T08:00:00.000Z');
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
        body: {
          staffMemberId: jo.id,
          startsAt: '2026-11-18T12:00:00.000Z',
          endsAt: '2026-11-18T20:00:00.000Z',
        },
      });
    });

    it('responds with 200 and the updated Shift', async () => {
      expect([response.status, await response.json()]).toEqual([
        200,
        {
          id: shift.id,
          staffMemberId: jo.id,
          startsAt: '2026-11-18T12:00:00.000Z',
          endsAt: '2026-11-18T20:00:00.000Z',
          response: 'pending',
          declineReason: null,
          started: false,
        },
      ]);
    });

    it('stores the change on the same Shift', async () => {
      expect(await storedShifts(app)).toEqual([
        {
          id: shift.id,
          staffMemberId: jo.id,
          startsAt: new Date('2026-11-18T12:00:00.000Z'),
          endsAt: new Date('2026-11-18T20:00:00.000Z'),
        },
      ]);
    });
  });

  describe('when the Owner moves the Shift an hour later, over its own old times', () => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-16T10:00:00.000Z',
          endsAt: '2026-11-16T18:00:00.000Z',
        },
      });
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('stores the new times', async () => {
      expect(await app.db.shift.findUnique({ where: { id: shift.id } })).toMatchObject({
        startsAt: new Date('2026-11-16T10:00:00.000Z'),
        endsAt: new Date('2026-11-16T18:00:00.000Z'),
      });
    });
  });

  describe('when the Rota is Published', () => {
    let publishedShift: { id: string };

    beforeEach(async () => {
      const publishedRota = await createPublishedRotaFor(app.db, ownVenue, '2026-11-23');
      publishedShift = await createShift(app.db, publishedRota, sam, {
        startsAt: '2026-11-23T09:00:00.000Z',
        endsAt: '2026-11-23T17:00:00.000Z',
      });
      response = await app.request('PATCH', shiftPath(ownVenue, '2026-11-23', publishedShift), {
        as: OWNER,
        body: {
          staffMemberId: jo.id,
          startsAt: '2026-11-23T09:00:00.000Z',
          endsAt: '2026-11-23T17:00:00.000Z',
        },
      });
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('moves the Shift to Jo', async () => {
      expect(await app.db.shift.findUnique({ where: { id: publishedShift.id } })).toMatchObject({
        staffMemberId: jo.id,
      });
    });
  });

  describe('when Jo already has a Shift from 16:00 to 20:00 on Monday', () => {
    beforeEach(async () => {
      await createShift(app.db, rota, jo, {
        startsAt: '2026-11-16T16:00:00.000Z',
        endsAt: '2026-11-16T20:00:00.000Z',
      });
    });

    describe("when Sam's Shift is moved to Jo", () => {
      beforeEach(async () => {
        response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
          as: OWNER,
          body: { staffMemberId: jo.id, ...MONDAY_9_TO_5 },
        });
      });

      it('responds with 409 and the shift_overlaps code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'shift_overlaps' },
        ]);
      });

      it("leaves Sam's Shift with Sam", async () => {
        expect(await app.db.shift.findUnique({ where: { id: shift.id } })).toMatchObject({
          staffMemberId: sam.id,
        });
      });
    });

    describe("when Sam's Shift is moved to Jo, ending as Jo's starts", () => {
      beforeEach(async () => {
        response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
          as: OWNER,
          body: {
            staffMemberId: jo.id,
            startsAt: '2026-11-16T08:00:00.000Z',
            endsAt: '2026-11-16T16:00:00.000Z',
          },
        });
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('moves the Shift to Jo', async () => {
        expect(await app.db.shift.findUnique({ where: { id: shift.id } })).toMatchObject({
          staffMemberId: jo.id,
          startsAt: new Date('2026-11-16T08:00:00.000Z'),
        });
      });
    });
  });

  describe.each([
    {
      scenario: 'the end is before the start',
      times: { startsAt: '2026-11-16T17:00:00.000Z', endsAt: '2026-11-16T09:00:00.000Z' },
    },
    {
      scenario: 'the Shift is longer than 16 hours',
      times: { startsAt: '2026-11-16T06:00:00.000Z', endsAt: '2026-11-16T23:00:00.000Z' },
    },
    {
      scenario: 'the start is in the next Week',
      times: { startsAt: '2026-11-23T09:00:00.000Z', endsAt: '2026-11-23T17:00:00.000Z' },
    },
    {
      scenario: 'the start is not on a 15-minute step',
      times: { startsAt: '2026-11-16T09:10:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' },
    },
  ])('when $scenario', ({ times }) => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
        body: { staffMemberId: sam.id, ...times },
      });
    });

    it('responds with 400 and the invalid_request code', async () => {
      expect([response.status, await response.json()]).toEqual([
        400,
        { code: 'invalid_request' },
      ]);
    });

    it('leaves the Shift as it was', async () => {
      expect(await storedShifts(app)).toEqual([
        {
          id: shift.id,
          staffMemberId: sam.id,
          startsAt: new Date(MONDAY_9_TO_5.startsAt),
          endsAt: new Date(MONDAY_9_TO_5.endsAt),
        },
      ]);
    });
  });

  describe('when the Shift is moved to an archived Staff Member', () => {
    beforeEach(async () => {
      const archived = await createArchivedStaffMember(app.db, ownVenue, {
        name: 'Alex Gone',
        role: 'Bar',
        phone: null,
      });
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
        body: { staffMemberId: archived.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe("when the Shift is moved to another venue's Staff Member", () => {
    let theirs: { id: string };

    beforeEach(async () => {
      theirs = await createActiveStaffMember(app.db, otherVenue, {
        name: 'Pat Other',
        role: 'Bar',
        email: 'pat@example.com',
        phone: null,
      });
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, shift), {
        as: OWNER,
        body: { staffMemberId: theirs.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('leaves the Shift with Sam', async () => {
      expect(await app.db.shift.findUnique({ where: { id: shift.id } })).toMatchObject({
        staffMemberId: sam.id,
      });
    });
  });

  describe('when a member of another venue requests it', () => {
    let theirShift: { id: string };

    beforeEach(async () => {
      const theirStaffMember = await createActiveStaffMember(app.db, otherVenue, {
        name: 'Pat Other',
        role: 'Bar',
        email: 'pat@example.com',
        phone: null,
      });
      const theirRota = await createRotaFor(app.db, otherVenue, WEEK_START);
      theirShift = await createShift(app.db, theirRota, theirStaffMember, MONDAY_9_TO_5);
      response = await app.request('PATCH', shiftPath(otherVenue, WEEK_START, theirShift), {
        as: OWNER,
        body: {
          staffMemberId: theirStaffMember.id,
          startsAt: MONDAY_9_TO_5.startsAt,
          endsAt: '2026-11-16T18:00:00.000Z',
        },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it("leaves the other venue's Shift as it was", async () => {
      expect(await app.db.shift.findUnique({ where: { id: theirShift.id } })).toMatchObject({
        endsAt: new Date(MONDAY_9_TO_5.endsAt),
      });
    });
  });

  describe("when another venue's Shift is sent through the Owner's venue", () => {
    let theirShift: { id: string };
    let theirStaffMember: { id: string };

    beforeEach(async () => {
      theirStaffMember = await createActiveStaffMember(app.db, otherVenue, {
        name: 'Pat Other',
        role: 'Bar',
        email: 'pat@example.com',
        phone: null,
      });
      const theirRota = await createRotaFor(app.db, otherVenue, WEEK_START);
      theirShift = await createShift(app.db, theirRota, theirStaffMember, MONDAY_9_TO_5);
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, theirShift), {
        as: OWNER,
        body: { staffMemberId: sam.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it("leaves the other venue's Shift with its own Staff Member", async () => {
      expect(await app.db.shift.findUnique({ where: { id: theirShift.id } })).toMatchObject({
        staffMemberId: theirStaffMember.id,
      });
    });
  });

  describe("when the Shift is sent through another Week's URL", () => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, '2026-11-23', shift), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-23T09:00:00.000Z',
          endsAt: '2026-11-23T17:00:00.000Z',
        },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the Shift ID is not a UUID', () => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, WEEK_START, { id: 'abc' }), {
        as: OWNER,
        body: { staffMemberId: sam.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('PATCH', shiftPath(ownVenue, '2026-11-17', shift), {
        as: OWNER,
        body: { staffMemberId: sam.id, ...MONDAY_9_TO_5 },
      });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });
  });
});
