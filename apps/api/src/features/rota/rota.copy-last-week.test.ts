import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RotaStatus, ShiftResponse } from '#src/generated/prisma/client.js';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createRotaFor,
  createShift,
  createUser,
  createVenueFor,
} from '#test/seed.js';
import { startTestApp, type StaffMemberLock, type TestApp } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};
const LAST_WEEK = '2026-11-16';
const THIS_WEEK = '2026-11-23';
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const PAT = { name: 'Pat Gone', role: 'Bar', phone: null };
const LAST_MONDAY_9_TO_5 = {
  startsAt: '2026-11-16T09:00:00.000Z',
  endsAt: '2026-11-16T17:00:00.000Z',
};

interface CopyResult {
  rota: {
    status: string;
    shifts: {
      staffMemberId: string;
      startsAt: string;
      endsAt: string;
      role: string | null;
      notes: string | null;
    }[];
  };
  skippedShifts: number;
}

function copyPath(venue: { id: string }, weekStart = THIS_WEEK) {
  return `/api/venues/${venue.id}/rotas/${weekStart}/copy-last-week`;
}

function inWeek(weekStart: string) {
  return { rota: { weekStart: new Date(`${weekStart}T00:00:00Z`) } };
}

describe('POST /api/venues/:venueId/rotas/:weekStart/copy-last-week', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };
  let sam: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    app.setClock('2026-11-20T10:00:00.000Z');
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
      response = await app.request('POST', copyPath(ownVenue));
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('POST', copyPath(ownVenue, '2026-11-24'), { as: OWNER });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      const jo = await createActiveStaffMember(app.db, otherVenue, JO);
      const lastWeek = await createRotaFor(app.db, otherVenue, LAST_WEEK);
      await createShift(app.db, lastWeek, jo, LAST_MONDAY_9_TO_5);
      response = await app.request('POST', copyPath(otherVenue), { as: OWNER });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it("copies nothing into the other venue's Week", async () => {
      expect(await app.db.shift.count({ where: { venueId: otherVenue.id } })).toBe(1);
    });
  });

  describe('when last Week has no Shifts', () => {
    beforeEach(async () => {
      response = await app.request('POST', copyPath(ownVenue), { as: OWNER });
    });

    it('responds with 200, an empty Draft Rota and nothing skipped', async () => {
      expect([response.status, await response.json()]).toMatchObject([
        200,
        { rota: { status: 'draft', shifts: [] }, skippedShifts: 0 },
      ]);
    });
  });

  describe('when last Week has a Monday Shift for Sam', () => {
    beforeEach(async () => {
      const lastWeek = await createRotaFor(app.db, ownVenue, LAST_WEEK);
      await createShift(app.db, lastWeek, sam, LAST_MONDAY_9_TO_5);
    });

    describe('when this Week is already Published', () => {
      beforeEach(async () => {
        const thisWeek = await createRotaFor(app.db, ownVenue, THIS_WEEK);
        await app.db.rota.update({
          where: { id: thisWeek.id },
          data: { status: RotaStatus.published, publishedAt: new Date('2026-11-20T09:00:00.000Z') },
        });
        response = await app.request('POST', copyPath(ownVenue), { as: OWNER });
      });

      it('responds with 409 and the rota_already_published code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'rota_already_published' },
        ]);
      });

      it('copies no Shifts', async () => {
        expect(await app.db.shift.count({ where: inWeek(THIS_WEEK) })).toBe(0);
      });
    });

    describe('when this Week already has a Shift', () => {
      beforeEach(async () => {
        const thisWeek = await createRotaFor(app.db, ownVenue, THIS_WEEK);
        await createShift(app.db, thisWeek, sam, {
          startsAt: '2026-11-24T09:00:00.000Z',
          endsAt: '2026-11-24T17:00:00.000Z',
        });
        response = await app.request('POST', copyPath(ownVenue), { as: OWNER });
      });

      it('responds with 409 and the rota_has_shifts code', async () => {
        expect([response.status, await response.json()]).toEqual([409, { code: 'rota_has_shifts' }]);
      });

      it('copies no Shifts', async () => {
        expect(await app.db.shift.count({ where: inWeek(THIS_WEEK) })).toBe(1);
      });
    });
  });

  describe("when last Week had Shifts for Sam and Jo, a deleted one, and one for Pat, who's archived", () => {
    let jo: { id: string };
    let pat: { id: string };

    beforeEach(async () => {
      jo = await createActiveStaffMember(app.db, ownVenue, JO);
      pat = await createArchivedStaffMember(app.db, ownVenue, PAT);
      const lastWeek = await createRotaFor(app.db, ownVenue, LAST_WEEK);
      const samsMonday = await createShift(app.db, lastWeek, sam, LAST_MONDAY_9_TO_5);
      await app.db.shift.update({
        where: { id: samsMonday.id },
        data: {
          role: 'Bar',
          notes: 'Cash up',
          response: ShiftResponse.confirmed,
          respondedAt: new Date('2026-11-15T08:00:00.000Z'),
        },
      });
      await createShift(app.db, lastWeek, jo, {
        startsAt: '2026-11-17T18:00:00.000Z',
        endsAt: '2026-11-17T23:00:00.000Z',
      });
      const deleted = await createShift(app.db, lastWeek, jo, {
        startsAt: '2026-11-19T09:00:00.000Z',
        endsAt: '2026-11-19T17:00:00.000Z',
      });
      await app.db.shift.update({
        where: { id: deleted.id },
        data: { deletedAt: new Date('2026-11-15T08:00:00.000Z') },
      });
      await createShift(app.db, lastWeek, pat, {
        startsAt: '2026-11-18T09:00:00.000Z',
        endsAt: '2026-11-18T17:00:00.000Z',
      });
    });

    describe('when the Owner copies last Week into this Week', () => {
      beforeEach(async () => {
        response = await app.request('POST', copyPath(ownVenue), { as: OWNER });
      });

      it("responds with 200 and this Week's Draft Rota with Sam's and Jo's Shifts a Week later", async () => {
        const { rota } = (await response.json()) as CopyResult;
        expect([response.status, rota.status, rota.shifts]).toMatchObject([
          200,
          'draft',
          [
            {
              staffMemberId: sam.id,
              startsAt: '2026-11-23T09:00:00.000Z',
              endsAt: '2026-11-23T17:00:00.000Z',
            },
            {
              staffMemberId: jo.id,
              startsAt: '2026-11-24T18:00:00.000Z',
              endsAt: '2026-11-24T23:00:00.000Z',
            },
          ],
        ]);
      });

      it('reports nothing skipped', async () => {
        expect(((await response.json()) as CopyResult).skippedShifts).toBe(0);
      });

      it("keeps Sam's Role and notes", async () => {
        const { rota } = (await response.json()) as CopyResult;
        expect(rota.shifts[0]).toMatchObject({ role: 'Bar', notes: 'Cash up' });
      });

      it('resets the Shift Response to Pending', async () => {
        expect(
          await app.db.shift.findMany({
            where: inWeek(THIS_WEEK),
            select: { response: true, respondedAt: true },
          }),
        ).toEqual([
          { response: 'pending', respondedAt: null },
          { response: 'pending', respondedAt: null },
        ]);
      });

      it("doesn't copy Pat's Shift", async () => {
        expect(
          await app.db.shift.count({ where: { staffMemberId: pat.id, ...inWeek(THIS_WEEK) } }),
        ).toBe(0);
      });

      it('leaves last Week unchanged', async () => {
        expect(await app.db.shift.count({ where: inWeek(LAST_WEEK) })).toBe(4);
      });
    });
  });

  describe.each([
    {
      change: 'the clocks go forward in March',
      lastWeek: '2026-03-23',
      thisWeek: '2026-03-30',
      last: { startsAt: '2026-03-23T18:00:00.000Z', endsAt: '2026-03-23T23:00:00.000Z' },
      copied: { startsAt: '2026-03-30T17:00:00.000Z', endsAt: '2026-03-30T22:00:00.000Z' },
    },
    {
      change: 'the clocks go back in October',
      lastWeek: '2026-10-19',
      thisWeek: '2026-10-26',
      last: { startsAt: '2026-10-19T17:00:00.000Z', endsAt: '2026-10-19T22:00:00.000Z' },
      copied: { startsAt: '2026-10-26T18:00:00.000Z', endsAt: '2026-10-26T23:00:00.000Z' },
    },
  ])('when the Owner copies an 18:00–23:00 Shift across $change', ({ lastWeek, thisWeek, last, copied }) => {
    beforeEach(async () => {
      app.setClock(`${lastWeek}T08:00:00.000Z`);
      const rota = await createRotaFor(app.db, ownVenue, lastWeek);
      await createShift(app.db, rota, sam, last);
      response = await app.request('POST', copyPath(ownVenue, thisWeek), { as: OWNER });
    });

    it('keeps it at 18:00–23:00 local time', async () => {
      expect(((await response.json()) as CopyResult).rota.shifts).toMatchObject([copied]);
    });
  });

  describe("when last Week's Sunday Overnight Shift runs into a Monday Shift that would be copied", () => {
    beforeEach(async () => {
      const lastWeek = await createRotaFor(app.db, ownVenue, LAST_WEEK);
      await createShift(app.db, lastWeek, sam, {
        startsAt: '2026-11-16T01:00:00.000Z',
        endsAt: '2026-11-16T05:00:00.000Z',
      });
      await createShift(app.db, lastWeek, sam, {
        startsAt: '2026-11-22T22:00:00.000Z',
        endsAt: '2026-11-23T03:00:00.000Z',
      });
      response = await app.request('POST', copyPath(ownVenue), { as: OWNER });
    });

    it('copies the Sunday Shift but not the Monday one that would overlap it', async () => {
      expect(((await response.json()) as CopyResult).rota.shifts).toMatchObject([
        { startsAt: '2026-11-29T22:00:00.000Z', endsAt: '2026-11-30T03:00:00.000Z' },
      ]);
    });

    it('reports one Shift skipped', async () => {
      expect(((await response.json()) as CopyResult).skippedShifts).toBe(1);
    });
  });

  describe("when the Owner copies last Week while another request holds Sam's row lock", () => {
    let jo: { id: string };
    let thisWeek: { id: string; venueId: string };
    let lock: StaffMemberLock;
    let pending: Promise<Response>;

    beforeEach(async () => {
      jo = await createActiveStaffMember(app.db, ownVenue, JO);
      const lastWeek = await createRotaFor(app.db, ownVenue, LAST_WEEK);
      await createShift(app.db, lastWeek, sam, LAST_MONDAY_9_TO_5);
      await createShift(app.db, lastWeek, jo, {
        startsAt: '2026-11-17T18:00:00.000Z',
        endsAt: '2026-11-17T23:00:00.000Z',
      });
      thisWeek = await createRotaFor(app.db, ownVenue, THIS_WEEK);
      lock = await app.holdStaffMemberLock(sam.id);
      pending = app.request('POST', copyPath(ownVenue), { as: OWNER });
      await lock.waitForBlockedRequest();
    });

    describe('when that request archives Sam and commits', () => {
      beforeEach(async () => {
        await lock.commitAfter((tx) =>
          tx.staffMember.update({
            where: { id: sam.id },
            data: { archivedAt: new Date('2026-11-20T09:00:00.000Z'), email: null },
          }),
        );
        response = await pending;
      });

      it("responds with only Jo's Shift", async () => {
        const { rota } = (await response.json()) as CopyResult;
        expect(rota.shifts.map(({ staffMemberId }) => staffMemberId)).toEqual([jo.id]);
      });

      it('reports one Shift skipped', async () => {
        expect(((await response.json()) as CopyResult).skippedShifts).toBe(1);
      });

      it('stores no Shift for Sam this Week', async () => {
        expect(
          await app.db.shift.count({ where: { staffMemberId: sam.id, ...inWeek(THIS_WEEK) } }),
        ).toBe(0);
      });
    });

    describe('when that request adds a Shift for Sam overlapping the Monday copy and commits', () => {
      beforeEach(async () => {
        await lock.commitAfter((tx) =>
          tx.shift.create({
            data: {
              venueId: thisWeek.venueId,
              rotaId: thisWeek.id,
              staffMemberId: sam.id,
              startsAt: new Date('2026-11-23T12:00:00.000Z'),
              endsAt: new Date('2026-11-23T20:00:00.000Z'),
            },
          }),
        );
        response = await pending;
      });

      it('reports one Shift skipped', async () => {
        expect(((await response.json()) as CopyResult).skippedShifts).toBe(1);
      });

      it("stores only the other request's Shift for Sam this Week", async () => {
        expect(
          await app.db.shift.findMany({
            where: { staffMemberId: sam.id, ...inWeek(THIS_WEEK) },
            select: { startsAt: true },
          }),
        ).toEqual([{ startsAt: new Date('2026-11-23T12:00:00.000Z') }]);
      });
    });
  });

  describe('when a 16-hour Overnight Shift would land on the night the clocks go back', () => {
    beforeEach(async () => {
      app.setClock('2026-10-12T08:00:00.000Z');
      const lastWeek = await createRotaFor(app.db, ownVenue, '2026-10-12');
      await createShift(app.db, lastWeek, sam, {
        startsAt: '2026-10-17T15:00:00.000Z',
        endsAt: '2026-10-18T07:00:00.000Z',
      });
      response = await app.request('POST', copyPath(ownVenue, '2026-10-19'), { as: OWNER });
    });

    it('skips it, since it would run 17 hours', async () => {
      expect((await response.json()) as CopyResult).toMatchObject({
        rota: { shifts: [] },
        skippedShifts: 1,
      });
    });
  });
});
