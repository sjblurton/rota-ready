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
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };

describe('GET /api/staff-links/:token', () => {
  let app: TestApp;
  let response: Response;
  let venue: { id: string };
  let sam: { id: string };
  let token: string;

  function staffLinkPath() {
    return `/api/venues/${venue.id}/staff-members/${sam.id}/staff-link`;
  }

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    const added = await app.request('POST', `/api/venues/${venue.id}/staff-members`, {
      as: OWNER,
      body: SAM,
    });
    sam = (await added.json()) as { id: string };
    const link = await app.request('GET', staffLinkPath(), { as: OWNER });
    ({ token } = (await link.json()) as { token: string });
  });

  afterEach(() => app.close());

  describe('when a Staff Member opens their Staff Link without logging in', () => {
    beforeEach(async () => {
      response = await app.request('GET', `/api/staff-links/${token}`);
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('returns their first name, the Venue name and its timezone, and no Shifts yet', async () => {
      expect(await response.json()).toEqual({
        firstName: 'Sam',
        venueName: 'The Crown',
        timeZone: 'Europe/London',
        shifts: [],
        removedShifts: [],
      });
    });

    it('never writes the token to the logs', () => {
      expect([app.logs().includes('/api/staff-links/'), app.logs().includes(token)]).toEqual([
        true,
        false,
      ]);
    });
  });

  describe('when it is Wednesday at noon and Sam has Shifts in Published and Draft Rotas', () => {
    let shifts: Record<
      | 'monday'
      | 'endedAtNoon'
      | 'sunday'
      | 'thursday'
      | 'inProgress'
      | 'joThursday'
      | 'draftMonday',
      { id: string }
    >;

    beforeEach(async () => {
      app.setClock('2026-11-18T12:00:00.000Z');
      const jo = await createActiveStaffMember(app.db, venue, JO);
      const published = await createPublishedRotaFor(app.db, venue, '2026-11-16');
      const draft = await createRotaFor(app.db, venue, '2026-11-23');
      shifts = {
        monday: await createShift(app.db, published, sam, {
          startsAt: '2026-11-16T09:00:00.000Z',
          endsAt: '2026-11-16T17:00:00.000Z',
        }),
        endedAtNoon: await createShift(app.db, published, sam, {
          startsAt: '2026-11-18T06:00:00.000Z',
          endsAt: '2026-11-18T12:00:00.000Z',
        }),
        sunday: await createShift(app.db, published, sam, {
          startsAt: '2026-11-22T20:00:00.000Z',
          endsAt: '2026-11-23T02:00:00.000Z',
        }),
        thursday: await createShift(app.db, published, sam, {
          startsAt: '2026-11-19T09:00:00.000Z',
          endsAt: '2026-11-19T17:00:00.000Z',
        }),
        inProgress: await createShift(app.db, published, sam, {
          startsAt: '2026-11-18T12:00:00.000Z',
          endsAt: '2026-11-18T18:00:00.000Z',
        }),
        joThursday: await createShift(app.db, published, jo, {
          startsAt: '2026-11-19T09:00:00.000Z',
          endsAt: '2026-11-19T17:00:00.000Z',
        }),
        draftMonday: await createShift(app.db, draft, sam, {
          startsAt: '2026-11-23T09:00:00.000Z',
          endsAt: '2026-11-23T17:00:00.000Z',
        }),
      };
      response = await app.request('GET', `/api/staff-links/${token}`);
    });

    async function returnedShiftIds() {
      const { shifts: returned } = (await response.json()) as { shifts: { id: string }[] };
      return returned.map(({ id }) => id);
    }

    it("returns Sam's Published Shifts that haven't ended, earliest first, with their times", async () => {
      expect(await response.json()).toMatchObject({
        shifts: [
          {
            id: shifts.inProgress.id,
            startsAt: '2026-11-18T12:00:00.000Z',
            endsAt: '2026-11-18T18:00:00.000Z',
          },
          {
            id: shifts.thursday.id,
            startsAt: '2026-11-19T09:00:00.000Z',
            endsAt: '2026-11-19T17:00:00.000Z',
          },
          {
            id: shifts.sunday.id,
            startsAt: '2026-11-22T20:00:00.000Z',
            endsAt: '2026-11-23T02:00:00.000Z',
          },
        ],
      });
    });

    it('leaves out Shifts that have already ended, including one that ended at noon', async () => {
      const ended = [shifts.monday.id, shifts.endedAtNoon.id];
      expect((await returnedShiftIds()).filter((id) => ended.includes(id))).toEqual([]);
    });

    it('leaves out Shifts in a Draft Rota', async () => {
      expect(await returnedShiftIds()).not.toContain(shifts.draftMonday.id);
    });

    it("leaves out other Staff Members' Shifts", async () => {
      expect(await returnedShiftIds()).not.toContain(shifts.joThursday.id);
    });

    it('marks the Shift that began at noon as started, and the later ones as not', async () => {
      const { shifts: returned } = (await response.json()) as {
        shifts: { id: string; started: boolean }[];
      };
      expect(returned.map(({ id, started }) => ({ id, started }))).toEqual([
        { id: shifts.inProgress.id, started: true },
        { id: shifts.thursday.id, started: false },
        { id: shifts.sunday.id, started: false },
      ]);
    });

    describe('when the clock moves past the end of the Thursday Shift', () => {
      beforeEach(async () => {
        app.setClock('2026-11-19T17:00:00.000Z');
        response = await app.request('GET', `/api/staff-links/${token}`);
      });

      it('returns only the Sunday Shift', async () => {
        expect(await returnedShiftIds()).toEqual([shifts.sunday.id]);
      });
    });
  });

  describe('when Sam was notified about Shifts on Thursday and Friday, and it is Wednesday at noon', () => {
    const THURSDAY_9_TO_5 = {
      startsAt: '2026-11-19T09:00:00.000Z',
      endsAt: '2026-11-19T17:00:00.000Z',
    };
    const FRIDAY_6_TO_11 = {
      startsAt: '2026-11-20T18:00:00.000Z',
      endsAt: '2026-11-20T23:00:00.000Z',
    };
    let jo: { id: string };
    let thursday: { id: string };
    let friday: { id: string };

    function shiftPath(shift: { id: string }) {
      return `/api/venues/${venue.id}/rotas/2026-11-16/shifts/${shift.id}`;
    }

    async function staffLinkPageOf(staffMember: { id: string }) {
      const link = await app.request(
        'GET',
        `/api/venues/${venue.id}/staff-members/${staffMember.id}/staff-link`,
        { as: OWNER },
      );
      const { token: theirToken } = (await link.json()) as { token: string };
      const page = await app.request('GET', `/api/staff-links/${theirToken}`);
      return (await page.json()) as {
        shifts: { id: string; response: string; changed: boolean; previous: object | null }[];
        removedShifts: { id: string }[];
      };
    }

    async function sendUpdates() {
      await app.request('POST', `/api/venues/${venue.id}/rotas/2026-11-16/send-updates`, {
        as: OWNER,
      });
    }

    async function previousOf(staffMember: { id: string }, shift: { id: string }) {
      const { shifts } = await staffLinkPageOf(staffMember);
      return shifts.find(({ id }) => id === shift.id)?.previous;
    }

    beforeEach(async () => {
      jo = await createActiveStaffMember(app.db, venue, JO);
      const draft = await createRotaFor(app.db, venue, '2026-11-16');
      thursday = await createShift(app.db, draft, sam, THURSDAY_9_TO_5);
      friday = await createShift(app.db, draft, sam, FRIDAY_6_TO_11);
      await app.request('POST', `/api/venues/${venue.id}/rotas/2026-11-16/publish`, { as: OWNER });
      app.setClock('2026-11-18T12:00:00.000Z');
    });

    describe('when the Owner reassigns the Thursday Shift to Jo', () => {
      beforeEach(async () => {
        await app.request('PATCH', shiftPath(thursday), {
          as: OWNER,
          body: { staffMemberId: jo.id, ...THURSDAY_9_TO_5 },
        });
      });

      it("shows it to Sam as a Removed Shift, with the times Sam was notified of", async () => {
        expect((await staffLinkPageOf(sam)).removedShifts).toEqual([
          { id: thursday.id, ...THURSDAY_9_TO_5 },
        ]);
      });

      it("leaves it out of Sam's upcoming Shifts", async () => {
        expect((await staffLinkPageOf(sam)).shifts.map(({ id }) => id)).toEqual([friday.id]);
      });

      it("shows it to Jo as Pending", async () => {
        expect((await staffLinkPageOf(jo)).shifts).toMatchObject([
          { id: thursday.id, response: 'pending' },
        ]);
      });

      it('shows Jo no Removed Shifts', async () => {
        expect((await staffLinkPageOf(jo)).removedShifts).toEqual([]);
      });

      describe('when the Owner sends updates', () => {
        beforeEach(sendUpdates);

        it('still shows it to Sam as a Removed Shift, with the times Sam was notified of', async () => {
          expect((await staffLinkPageOf(sam)).removedShifts).toEqual([
            { id: thursday.id, ...THURSDAY_9_TO_5 },
          ]);
        });

        it('shows it to Jo with no earlier times, since Jo was never notified of them', async () => {
          expect(await previousOf(jo, thursday)).toBeNull();
        });

        describe('when the Owner moves it an hour later for Jo and sends another update', () => {
          beforeEach(async () => {
            await app.request('PATCH', shiftPath(thursday), {
              as: OWNER,
              body: {
                staffMemberId: jo.id,
                startsAt: '2026-11-19T10:00:00.000Z',
                endsAt: '2026-11-19T18:00:00.000Z',
              },
            });
            await sendUpdates();
          });

          it('still shows it to Sam as a Removed Shift, with the times Sam was notified of', async () => {
            expect((await staffLinkPageOf(sam)).removedShifts).toEqual([
              { id: thursday.id, ...THURSDAY_9_TO_5 },
            ]);
          });
        });

        describe('when the Owner deletes it and sends another update', () => {
          beforeEach(async () => {
            await app.request('DELETE', shiftPath(thursday), { as: OWNER });
            await sendUpdates();
          });

          it('shows it to both Sam and Jo as a Removed Shift', async () => {
            expect([
              (await staffLinkPageOf(sam)).removedShifts,
              (await staffLinkPageOf(jo)).removedShifts,
            ]).toEqual([
              [{ id: thursday.id, ...THURSDAY_9_TO_5 }],
              [{ id: thursday.id, ...THURSDAY_9_TO_5 }],
            ]);
          });
        });

        describe('when the clock reaches the time the Thursday Shift starts', () => {
          beforeEach(() => {
            app.setClock(THURSDAY_9_TO_5.startsAt);
          });

          it('no longer shows Sam the Removed Shift', async () => {
            expect((await staffLinkPageOf(sam)).removedShifts).toEqual([]);
          });
        });
      });

      describe('when the Owner gives it back to Sam', () => {
        beforeEach(async () => {
          await app.request('PATCH', shiftPath(thursday), {
            as: OWNER,
            body: { staffMemberId: sam.id, ...THURSDAY_9_TO_5 },
          });
        });

        it('no longer shows Sam a Removed Shift', async () => {
          expect((await staffLinkPageOf(sam)).removedShifts).toEqual([]);
        });
      });
    });

    describe('when the Owner moves the Thursday Shift an hour later for Sam', () => {
      beforeEach(async () => {
        await app.request('PATCH', shiftPath(thursday), {
          as: OWNER,
          body: {
            staffMemberId: sam.id,
            startsAt: '2026-11-19T10:00:00.000Z',
            endsAt: '2026-11-19T18:00:00.000Z',
          },
        });
      });

      it('shows Sam no Removed Shifts', async () => {
        expect((await staffLinkPageOf(sam)).removedShifts).toEqual([]);
      });

      it('shows Sam no earlier times before the update is sent', async () => {
        expect(await previousOf(sam, thursday)).toBeNull();
      });

      it('marks it Changed for Sam before the update is sent', async () => {
        const { shifts } = await staffLinkPageOf(sam);
        expect(shifts.find(({ id }) => id === thursday.id)?.changed).toBe(true);
      });

      describe('when the Owner sends updates', () => {
        beforeEach(sendUpdates);

        it('shows Sam the times Sam was notified of before', async () => {
          expect(await previousOf(sam, thursday)).toEqual(THURSDAY_9_TO_5);
        });

        it('no longer marks it Changed for Sam', async () => {
          const { shifts } = await staffLinkPageOf(sam);
          expect(shifts.find(({ id }) => id === thursday.id)?.changed).toBe(false);
        });

        describe('when Sam Confirms it', () => {
          beforeEach(async () => {
            const link = await app.request('GET', staffLinkPath(), { as: OWNER });
            const { token: samsToken } = (await link.json()) as { token: string };
            await app.request('PUT', `/api/staff-links/${samsToken}/shifts/${thursday.id}/response`, {
              body: { response: 'confirmed' },
            });
          });

          it('no longer shows Sam the earlier times', async () => {
            expect(await previousOf(sam, thursday)).toBeNull();
          });
        });

        describe('when the Owner moves it again before sending another update', () => {
          beforeEach(async () => {
            await app.request('PATCH', shiftPath(thursday), {
              as: OWNER,
              body: {
                staffMemberId: sam.id,
                startsAt: '2026-11-19T11:00:00.000Z',
                endsAt: '2026-11-19T19:00:00.000Z',
              },
            });
          });

          it('shows Sam no earlier times until that update is sent', async () => {
            expect(await previousOf(sam, thursday)).toBeNull();
          });
        });
      });
    });

    describe('when the Owner deletes the Friday Shift', () => {
      beforeEach(async () => {
        await app.request('DELETE', shiftPath(friday), { as: OWNER });
      });

      it('shows it to Sam as a Removed Shift', async () => {
        expect((await staffLinkPageOf(sam)).removedShifts).toEqual([
          { id: friday.id, ...FRIDAY_6_TO_11 },
        ]);
      });

      it("leaves it out of Sam's upcoming Shifts", async () => {
        expect((await staffLinkPageOf(sam)).shifts.map(({ id }) => id)).toEqual([thursday.id]);
      });

      describe('when the Owner sends updates', () => {
        beforeEach(sendUpdates);

        it('still shows it to Sam as a Removed Shift', async () => {
          expect((await staffLinkPageOf(sam)).removedShifts).toEqual([
            { id: friday.id, ...FRIDAY_6_TO_11 },
          ]);
        });

        describe('when the clock reaches the time the Friday Shift would have started', () => {
          beforeEach(() => {
            app.setClock(FRIDAY_6_TO_11.startsAt);
          });

          it('no longer shows Sam the Removed Shift', async () => {
            expect((await staffLinkPageOf(sam)).removedShifts).toEqual([]);
          });
        });
      });

      describe('when the clock reaches the time the Friday Shift would have started', () => {
        beforeEach(() => {
          app.setClock(FRIDAY_6_TO_11.startsAt);
        });

        it('no longer shows Sam the Removed Shift', async () => {
          expect((await staffLinkPageOf(sam)).removedShifts).toEqual([]);
        });
      });
    });
  });

  describe('when the token is unknown', () => {
    beforeEach(async () => {
      response = await app.request('GET', `/api/staff-links/${'x'.repeat(43)}`);
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the Staff Link has been regenerated', () => {
    beforeEach(async () => {
      await app.request('POST', `${staffLinkPath()}/regenerate`, { as: OWNER });
      response = await app.request('GET', `/api/staff-links/${token}`);
    });

    it('responds to the old token with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the Staff Member has been archived', () => {
    beforeEach(async () => {
      await app.request('POST', `/api/venues/${venue.id}/staff-members/${sam.id}/archive`, {
        as: OWNER,
      });
      response = await app.request('GET', `/api/staff-links/${token}`);
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });
});
