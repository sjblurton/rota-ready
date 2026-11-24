import type { SendUpdatesResult } from '@rota-ready/shared';
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
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
const KIM = { name: 'Kim Lee', role: 'Bar', email: 'kim@example.com', phone: null };
const MONDAY_9_TO_5 = { startsAt: '2026-11-16T09:00:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' };
const MONDAY_10_TO_5 = { startsAt: '2026-11-16T10:00:00.000Z', endsAt: '2026-11-16T17:00:00.000Z' };
const TUESDAY_9_TO_5 = { startsAt: '2026-11-17T09:00:00.000Z', endsAt: '2026-11-17T17:00:00.000Z' };
const WEDNESDAY_9_TO_5 = {
  startsAt: '2026-11-18T09:00:00.000Z',
  endsAt: '2026-11-18T17:00:00.000Z',
};
const THURSDAY_9_TO_5 = {
  startsAt: '2026-11-19T09:00:00.000Z',
  endsAt: '2026-11-19T17:00:00.000Z',
};

function rotaPath(venue: { id: string }) {
  return `/api/venues/${venue.id}/rotas/${WEEK_START}`;
}

function sendUpdatesPath(venue: { id: string }, weekStart = WEEK_START) {
  return `/api/venues/${venue.id}/rotas/${weekStart}/send-updates`;
}

function namesIn({ staffMembers }: SendUpdatesResult) {
  return staffMembers.map(({ name }) => name);
}

function updatesFor({ staffMembers }: SendUpdatesResult, name: string) {
  return staffMembers.find((each) => each.name === name)?.updates;
}

describe('POST /api/venues/:venueId/rotas/:weekStart/send-updates', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };

  function shiftPath(shift: { id: string }) {
    return `${rotaPath(ownVenue)}/shifts/${shift.id}`;
  }

  function moveShift(shift: { id: string }, body: object) {
    return app.request('PATCH', shiftPath(shift), { as: OWNER, body });
  }

  async function publish(venue: { id: string }) {
    await app.request('POST', `${rotaPath(venue)}/publish`, { as: OWNER });
  }

  async function staffLinkTokenOf(staffMember: { id: string }) {
    const link = await app.request(
      'GET',
      `/api/venues/${ownVenue.id}/staff-members/${staffMember.id}/staff-link`,
      { as: OWNER },
    );
    const { token } = (await link.json()) as { token: string };
    return token;
  }

  async function sendUpdates(venue = ownVenue) {
    response = await app.request('POST', sendUpdatesPath(venue), { as: OWNER });
    return (await response.json()) as SendUpdatesResult;
  }

  beforeEach(async () => {
    app = await startTestApp();
    app.setClock('2026-11-14T10:00:00.000Z');
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
      response = await app.request('POST', sendUpdatesPath(ownVenue));
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('POST', sendUpdatesPath(ownVenue, '2026-11-17'), { as: OWNER });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });
  });

  describe('when the Rota is still a Draft', () => {
    beforeEach(async () => {
      const sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      const draft = await createRotaFor(app.db, ownVenue, WEEK_START);
      await createShift(app.db, draft, sam, MONDAY_9_TO_5);
      response = await app.request('POST', sendUpdatesPath(ownVenue), { as: OWNER });
    });

    it('responds with 409 and the rota_not_published code', async () => {
      expect([response.status, await response.json()]).toEqual([
        409,
        { code: 'rota_not_published' },
      ]);
    });

    it('sends no email', () => {
      expect(app.outbox.sent).toEqual([]);
    });
  });

  describe('when Sam, Jo, Alex and Kim were notified about their Shifts', () => {
    let sam: { id: string };
    let jo: { id: string };
    let alex: { id: string };
    let kim: { id: string };
    let samsMonday: { id: string };
    let josTuesday: { id: string };
    let kimsThursday: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      jo = await createActiveStaffMember(app.db, ownVenue, JO);
      alex = await createActiveStaffMember(app.db, ownVenue, ALEX);
      kim = await createActiveStaffMember(app.db, ownVenue, KIM);
      const rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      samsMonday = await createShift(app.db, rota, sam, MONDAY_9_TO_5);
      josTuesday = await createShift(app.db, rota, jo, TUESDAY_9_TO_5);
      await createShift(app.db, rota, alex, WEDNESDAY_9_TO_5);
      kimsThursday = await createShift(app.db, rota, kim, THURSDAY_9_TO_5);
      await publish(ownVenue);
    });

    describe('when nothing has changed since', () => {
      beforeEach(async () => {
        response = await app.request('POST', sendUpdatesPath(ownVenue), { as: OWNER });
      });

      it('responds with 200 and no Staff Members to notify', async () => {
        expect([response.status, await response.json()]).toEqual([200, { staffMembers: [] }]);
      });
    });

    describe('when only the notes on Sam\'s Monday Shift change', () => {
      let result: SendUpdatesResult;

      beforeEach(async () => {
        await moveShift(samsMonday, { staffMemberId: sam.id, ...MONDAY_9_TO_5, notes: 'Lock up' });
        result = await sendUpdates();
      });

      it('lists no Staff Members to notify', () => {
        expect(result.staffMembers).toEqual([]);
      });
    });

    describe("when the Owner moves Sam's Monday Shift an hour later and reassigns Jo's Tuesday Shift to Alex", () => {
      beforeEach(async () => {
        await moveShift(samsMonday, { staffMemberId: sam.id, ...MONDAY_10_TO_5 });
        await moveShift(josTuesday, { staffMemberId: alex.id, ...TUESDAY_9_TO_5 });
      });

      describe('when the Owner sends updates', () => {
        let result: SendUpdatesResult;

        beforeEach(async () => {
          result = await sendUpdates();
        });

        it('responds with 200', () => {
          expect(response.status).toBe(200);
        });

        it('lists Alex, Jo and Sam to notify, by name', () => {
          expect(result.staffMembers.map(({ staffMemberId, name }) => ({ staffMemberId, name }))).toEqual([
            { staffMemberId: alex.id, name: 'Alex Smith' },
            { staffMemberId: jo.id, name: 'Jo Bloggs' },
            { staffMemberId: sam.id, name: 'Sam Jones' },
          ]);
        });

        it('does not list Kim, whose Shift is unchanged', () => {
          expect(namesIn(result)).not.toContain('Kim Lee');
        });

        it('sends no email', () => {
          expect(app.outbox.sent).toEqual([]);
        });

        describe("when Sam's Staff Link is looked up", () => {
          let samsStaffLinkToken: string;

          beforeEach(async () => {
            samsStaffLinkToken = await staffLinkTokenOf(sam);
          });

          it("gives Sam's Staff Link token", () => {
            expect(result.staffMembers.find(({ name }) => name === 'Sam Jones')?.staffLinkToken).toBe(
              samsStaffLinkToken,
            );
          });
        });

        it("says Sam's Monday Shift changed, with its new times and what it was", () => {
          expect(updatesFor(result, 'Sam Jones')).toEqual([
            { kind: 'changed', ...MONDAY_10_TO_5, previous: MONDAY_9_TO_5 },
          ]);
        });

        it("says Jo's Tuesday Shift was removed", () => {
          expect(updatesFor(result, 'Jo Bloggs')).toEqual([{ kind: 'removed', ...TUESDAY_9_TO_5 }]);
        });

        it('says Alex has the new Tuesday Shift only, not the unchanged Wednesday one', () => {
          expect(updatesFor(result, 'Alex Smith')).toEqual([{ kind: 'added', ...TUESDAY_9_TO_5 }]);
        });

        describe('when the Owner opens the Week', () => {
          beforeEach(async () => {
            response = await app.request('GET', rotaPath(ownVenue), { as: OWNER });
          });

          it('shows no Changed or Removed Shifts', async () => {
            const { shifts, removedShifts } = (await response.json()) as {
              shifts: { changed: boolean }[];
              removedShifts: unknown[];
            };
            expect([shifts.map(({ changed }) => changed), removedShifts]).toEqual([
              [false, false, false, false],
              [],
            ]);
          });
        });

        it("keeps the times Sam was notified of before as the Monday Shift's previous times", async () => {
          expect(
            await app.db.shift.findUniqueOrThrow({
              where: { id: samsMonday.id },
              select: { previousStaffMemberId: true, previousStartsAt: true, previousEndsAt: true },
            }),
          ).toEqual({
            previousStaffMemberId: sam.id,
            previousStartsAt: new Date(MONDAY_9_TO_5.startsAt),
            previousEndsAt: new Date(MONDAY_9_TO_5.endsAt),
          });
        });

        describe('when the Owner sends updates again with nothing new', () => {
          beforeEach(async () => {
            result = await sendUpdates();
          });

          it('lists no Staff Members to notify', () => {
            expect(result.staffMembers).toEqual([]);
          });
        });
      });

      describe('when Jo is archived before the Owner sends updates', () => {
        let result: SendUpdatesResult;

        beforeEach(async () => {
          await app.request('POST', `/api/venues/${ownVenue.id}/staff-members/${jo.id}/archive`, {
            as: OWNER,
          });
          result = await sendUpdates();
        });

        it('lists only Alex and Sam to notify', () => {
          expect(namesIn(result)).toEqual(['Alex Smith', 'Sam Jones']);
        });
      });

      describe('when the Owner sends updates from two tabs at once', () => {
        let results: SendUpdatesResult[];

        beforeEach(async () => {
          const responses = await Promise.all([
            app.request('POST', sendUpdatesPath(ownVenue), { as: OWNER }),
            app.request('POST', sendUpdatesPath(ownVenue), { as: OWNER }),
          ]);
          results = (await Promise.all(responses.map((each) => each.json()))) as SendUpdatesResult[];
        });

        it('lists each affected Staff Member to notify once, across both tabs', () => {
          expect(results.flatMap(namesIn).sort()).toEqual(['Alex Smith', 'Jo Bloggs', 'Sam Jones']);
        });
      });
    });

    describe("when the Owner moves Sam's Monday Shift to Tuesday", () => {
      let result: SendUpdatesResult;

      beforeEach(async () => {
        await moveShift(samsMonday, { staffMemberId: sam.id, ...TUESDAY_9_TO_5 });
        result = await sendUpdates();
      });

      it("says Sam's Shift changed from Monday to Tuesday", () => {
        expect(updatesFor(result, 'Sam Jones')).toEqual([
          { kind: 'changed', ...TUESDAY_9_TO_5, previous: MONDAY_9_TO_5 },
        ]);
      });
    });

    describe("when the Owner deletes Kim's Thursday Shift and sends updates", () => {
      let result: SendUpdatesResult;

      beforeEach(async () => {
        await app.request('DELETE', shiftPath(kimsThursday), { as: OWNER });
        result = await sendUpdates();
      });

      it('lists only Kim to notify, not Sam, Jo or Alex, whose Shifts are unchanged', () => {
        expect(namesIn(result)).toEqual(['Kim Lee']);
      });

      it("says Kim's Thursday Shift was removed", () => {
        expect(updatesFor(result, 'Kim Lee')).toEqual([{ kind: 'removed', ...THURSDAY_9_TO_5 }]);
      });

      describe('when the Owner opens the Week', () => {
        beforeEach(async () => {
          response = await app.request('GET', rotaPath(ownVenue), { as: OWNER });
        });

        it('shows no Removed Shifts', async () => {
          expect(((await response.json()) as { removedShifts: unknown[] }).removedShifts).toEqual([]);
        });
      });
    });

    describe('when the Owner adds a Shift for Kim and sends updates', () => {
      let result: SendUpdatesResult;

      beforeEach(async () => {
        await app.request('POST', `${rotaPath(ownVenue)}/shifts`, {
          as: OWNER,
          body: { staffMemberId: kim.id, ...MONDAY_9_TO_5 },
        });
        result = await sendUpdates();
      });

      it('says Kim has a new Monday Shift', () => {
        expect(updatesFor(result, 'Kim Lee')).toEqual([{ kind: 'added', ...MONDAY_9_TO_5 }]);
      });
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      const pat = await createActiveStaffMember(app.db, otherVenue, SAM);
      const rota = await createRotaFor(app.db, otherVenue, WEEK_START);
      const shift = await createShift(app.db, rota, pat, MONDAY_9_TO_5);
      await app.request('POST', `${rotaPath(otherVenue)}/publish`, { as: OTHER_OWNER });
      await app.db.shift.update({
        where: { id: shift.id },
        data: { startsAt: new Date(MONDAY_10_TO_5.startsAt) },
      });
      response = await app.request('POST', sendUpdatesPath(otherVenue), { as: OWNER });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('sends no email', () => {
      expect(app.outbox.sent).toEqual([]);
    });
  });
});
