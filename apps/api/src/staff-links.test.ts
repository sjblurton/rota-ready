import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createPublishedRotaFor,
  createRotaFor,
  createShift,
  createUser,
  createVenueFor,
} from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

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
