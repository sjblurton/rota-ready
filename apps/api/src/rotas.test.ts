import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
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

function rotaPath(venue: { id: string }, weekStart: string) {
  return `/api/venues/${venue.id}/rotas/${weekStart}`;
}

function shiftsPath(venue: { id: string }, weekStart: string) {
  return `${rotaPath(venue, weekStart)}/shifts`;
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
  });
});

describe('POST /api/venues/:venueId/rotas/:weekStart/shifts', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };
  let sam: { id: string };

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
  });

  afterEach(() => app.close());

  describe('when no token is sent', () => {
    beforeEach(async () => {
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        },
      });
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when the Owner adds the first Shifts of a new Week from two tabs at once', () => {
    let responses: Response[];

    beforeEach(async () => {
      const jo = await createActiveStaffMember(app.db, ownVenue, JO);
      responses = await Promise.all(
        [sam, jo].map((staffMember) =>
          app.request('POST', shiftsPath(ownVenue, WEEK_START), {
            as: OWNER,
            body: {
              staffMemberId: staffMember.id,
              startsAt: '2026-11-16T09:00:00.000Z',
              endsAt: '2026-11-16T17:00:00.000Z',
            },
          }),
        ),
      );
    });

    it('responds with 201 to both', () => {
      expect(responses.map((each) => each.status)).toEqual([201, 201]);
    });

    it('stores only one Rota', async () => {
      expect(await app.db.rota.count()).toBe(1);
    });

    it('stores both Shifts in that Rota', async () => {
      const rota = await app.db.rota.findFirstOrThrow();
      expect(await app.db.shift.count({ where: { rotaId: rota.id } })).toBe(2);
    });
  });

  describe('when the Owner adds an Overnight Shift that starts on Sunday', () => {
    beforeEach(async () => {
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-22T20:00:00.000Z',
          endsAt: '2026-11-23T02:00:00.000Z',
        },
      });
    });

    it('responds with 201', () => {
      expect(response.status).toBe(201);
    });

    it('returns the Shift', async () => {
      expect(await response.json()).toEqual({
        id: expect.any(String),
        staffMemberId: sam.id,
        startsAt: '2026-11-22T20:00:00.000Z',
        endsAt: '2026-11-23T02:00:00.000Z',
      });
    });

    it('creates the Draft Rota for that Week and stores the Shift in it', async () => {
      expect(
        await app.db.shift.findMany({
          select: {
            venueId: true,
            staffMemberId: true,
            startsAt: true,
            endsAt: true,
            rota: { select: { venueId: true, weekStart: true, status: true } },
          },
        }),
      ).toEqual([
        {
          venueId: ownVenue.id,
          staffMemberId: sam.id,
          startsAt: new Date('2026-11-22T20:00:00.000Z'),
          endsAt: new Date('2026-11-23T02:00:00.000Z'),
          rota: {
            venueId: ownVenue.id,
            weekStart: new Date('2026-11-16T00:00:00.000Z'),
            status: 'draft',
          },
        },
      ]);
    });

    describe('when the Owner opens that Week', () => {
      beforeEach(async () => {
        response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
      });

      it('shows the Shift in the Rota', async () => {
        expect(await response.json()).toMatchObject({
          shifts: [
            {
              id: expect.any(String),
              staffMemberId: sam.id,
              startsAt: '2026-11-22T20:00:00.000Z',
              endsAt: '2026-11-23T02:00:00.000Z',
            },
          ],
        });
      });

      it('still stores only one Rota', async () => {
        expect(await app.db.rota.count()).toBe(1);
      });
    });
  });

  describe('when the Week already has a Rota', () => {
    let rota: { id: string };

    beforeEach(async () => {
      rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        },
      });
    });

    it('adds the Shift to the existing Rota', async () => {
      expect(await app.db.shift.findMany({ select: { rotaId: true } })).toEqual([
        { rotaId: rota.id },
      ]);
    });
  });

  describe('when a Shift starts just after midnight on Monday in British Summer Time', () => {
    const startsAt = '2026-07-12T23:30:00.000Z';
    const endsAt = '2026-07-13T07:30:00.000Z';

    describe('when it is added to the Week that Monday starts', () => {
      beforeEach(async () => {
        response = await app.request('POST', shiftsPath(ownVenue, '2026-07-13'), {
          as: OWNER,
          body: { staffMemberId: sam.id, startsAt, endsAt },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when it is added to the Week before, where it starts in UTC', () => {
      beforeEach(async () => {
        response = await app.request('POST', shiftsPath(ownVenue, '2026-07-06'), {
          as: OWNER,
          body: { staffMemberId: sam.id, startsAt, endsAt },
        });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('stores no Shift', async () => {
        expect(await app.db.shift.count()).toBe(0);
      });
    });
  });

  describe.each([
    {
      scenario: 'the end is before the start',
      body: { startsAt: '2026-11-16T17:00:00.000Z', endsAt: '2026-11-16T09:00:00.000Z' },
    },
    {
      scenario: 'the end is the same as the start',
      body: { startsAt: '2026-11-16T09:00:00.000Z', endsAt: '2026-11-16T09:00:00.000Z' },
    },
    {
      scenario: 'the Shift is longer than 16 hours',
      body: { startsAt: '2026-11-16T06:00:00.000Z', endsAt: '2026-11-16T23:00:00.000Z' },
    },
    {
      scenario: 'the start is in the next Week',
      body: { startsAt: '2026-11-23T09:00:00.000Z', endsAt: '2026-11-23T17:00:00.000Z' },
    },
    {
      scenario: 'the start is in the previous Week',
      body: { startsAt: '2026-11-15T09:00:00.000Z', endsAt: '2026-11-15T17:00:00.000Z' },
    },
    {
      scenario: 'the start is not on a 15-minute step',
      body: { startsAt: '2026-11-16T09:10:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' },
    },
    {
      scenario: 'the start is not a date and time',
      body: { startsAt: 'Monday 9am', endsAt: '2026-11-16T17:00:00.000Z' },
    },
  ])('when $scenario', ({ body }) => {
    beforeEach(async () => {
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: { staffMemberId: sam.id, ...body },
      });
    });

    it('responds with 400 and the invalid_request code', async () => {
      expect([response.status, await response.json()]).toEqual([
        400,
        { code: 'invalid_request' },
      ]);
    });

    it('stores no Shift', async () => {
      expect(await app.db.shift.count()).toBe(0);
    });
  });

  describe('when the Staff Member already has a Shift from 09:00 to 17:00 on Monday', () => {
    let existing: { id: string };
    let rota: { id: string; venueId: string };

    beforeEach(async () => {
      rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      existing = await createShift(app.db, rota, sam, {
        startsAt: '2026-11-16T09:00:00.000Z',
        endsAt: '2026-11-16T17:00:00.000Z',
      });
    });

    describe('when a Shift from 16:00 to 20:00 is added for them', () => {
      beforeEach(async () => {
        response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
          as: OWNER,
          body: {
            staffMemberId: sam.id,
            startsAt: '2026-11-16T16:00:00.000Z',
            endsAt: '2026-11-16T20:00:00.000Z',
          },
        });
      });

      it('responds with 409 and the shift_overlaps code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'shift_overlaps' },
        ]);
      });

      it('keeps only the existing Shift', async () => {
        expect(await app.db.shift.findMany({ select: { id: true } })).toEqual([
          { id: existing.id },
        ]);
      });
    });

    describe('when a Shift starting at 17:00 is added for them', () => {
      beforeEach(async () => {
        response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
          as: OWNER,
          body: {
            staffMemberId: sam.id,
            startsAt: '2026-11-16T17:00:00.000Z',
            endsAt: '2026-11-16T22:00:00.000Z',
          },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when a Shift at the same time is added for another Staff Member', () => {
      beforeEach(async () => {
        const jo = await createActiveStaffMember(app.db, ownVenue, JO);
        response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
          as: OWNER,
          body: {
            staffMemberId: jo.id,
            startsAt: '2026-11-16T09:00:00.000Z',
            endsAt: '2026-11-16T17:00:00.000Z',
          },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when four Shifts overlapping each other are added for them at once', () => {
      let responses: Response[];

      beforeEach(async () => {
        responses = await Promise.all(
          ['09', '10', '11', '12'].map((hour) =>
            app.request('POST', shiftsPath(ownVenue, WEEK_START), {
              as: OWNER,
              body: {
                staffMemberId: sam.id,
                startsAt: `2026-11-17T${hour}:00:00.000Z`,
                endsAt: '2026-11-17T17:00:00.000Z',
              },
            }),
          ),
        );
      });

      it('accepts one and responds to the others with 409', () => {
        expect(responses.map((each) => each.status).sort()).toEqual([201, 409, 409, 409]);
      });

      it('stores only one of them beside the existing Shift', async () => {
        expect(await app.db.shift.count({ where: { rotaId: rota.id } })).toBe(2);
      });
    });
  });

  describe("when the Staff Member's Overnight Shift from the previous Week runs into Monday", () => {
    beforeEach(async () => {
      const previousRota = await createRotaFor(app.db, ownVenue, '2026-11-09');
      await createShift(app.db, previousRota, sam, {
        startsAt: '2026-11-15T20:00:00.000Z',
        endsAt: '2026-11-16T02:00:00.000Z',
      });
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-16T01:00:00.000Z',
          endsAt: '2026-11-16T05:00:00.000Z',
        },
      });
    });

    it('responds with 409', () => {
      expect(response.status).toBe(409);
    });
  });

  describe('when the Staff Member is missing from the request', () => {
    beforeEach(async () => {
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: { startsAt: '2026-11-16T09:00:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' },
      });
    });

    it('responds with 400', () => {
      expect(response.status).toBe(400);
    });
  });

  describe('when the Staff Member is archived', () => {
    beforeEach(async () => {
      const archived = await createArchivedStaffMember(app.db, ownVenue, {
        name: 'Jo Bloggs',
        role: 'Floor',
        phone: null,
      });
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: archived.id,
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('stores no Shift', async () => {
      expect(await app.db.shift.count()).toBe(0);
    });
  });

  describe("when another venue's Staff Member is sent through the Owner's venue", () => {
    beforeEach(async () => {
      const otherStaffMember = await createActiveStaffMember(app.db, otherVenue, JO);
      response = await app.request('POST', shiftsPath(ownVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: otherStaffMember.id,
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('stores no Shift', async () => {
      expect(await app.db.shift.count()).toBe(0);
    });

    it('creates no Rota', async () => {
      expect(await app.db.rota.count()).toBe(0);
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      const otherStaffMember = await createActiveStaffMember(app.db, otherVenue, JO);
      response = await app.request('POST', shiftsPath(otherVenue, WEEK_START), {
        as: OWNER,
        body: {
          staffMemberId: otherStaffMember.id,
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('stores no Shift', async () => {
      expect(await app.db.shift.count()).toBe(0);
    });

    it('creates no Rota', async () => {
      expect(await app.db.rota.count()).toBe(0);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('POST', shiftsPath(ownVenue, '2026-11-17'), {
        as: OWNER,
        body: {
          staffMemberId: sam.id,
          startsAt: '2026-11-17T09:00:00.000Z',
          endsAt: '2026-11-17T17:00:00.000Z',
        },
      });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('stores no Shift', async () => {
      expect(await app.db.shift.count()).toBe(0);
    });
  });
});
