import type { PublishResult } from '@rota-ready/shared';
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
const WEEK_START = '2026-11-16';
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
const PAT = { name: 'Pat Gone', role: 'Bar', phone: null };
const MONDAY_9_TO_5 = {
  startsAt: '2026-11-16T09:00:00.000Z',
  endsAt: '2026-11-16T17:00:00.000Z',
};
const TUESDAY_9_TO_5 = {
  startsAt: '2026-11-17T09:00:00.000Z',
  endsAt: '2026-11-17T17:00:00.000Z',
};

function rotaPath(venue: { id: string }, weekStart: string) {
  return `/api/venues/${venue.id}/rotas/${weekStart}`;
}

function publishPath(venue: { id: string }, weekStart: string) {
  return `${rotaPath(venue, weekStart)}/publish`;
}

async function staffLinkTokenOf(app: TestApp, venue: { id: string }, staffMember: { id: string }) {
  const response = await app.request(
    'GET',
    `/api/venues/${venue.id}/staff-members/${staffMember.id}/staff-link`,
    { as: OWNER },
  );
  const { token } = (await response.json()) as { token: string };
  return token;
}


describe('POST /api/venues/:venueId/rotas/:weekStart/publish', () => {
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
      response = await app.request('POST', publishPath(ownVenue, WEEK_START));
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      await createRotaFor(app.db, otherVenue, WEEK_START);
      response = await app.request('POST', publishPath(otherVenue, WEEK_START), { as: OWNER });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('sends no email', () => {
      expect(app.outbox.sent).toEqual([]);
    });

    it("leaves the other venue's Rota as a Draft", async () => {
      expect(await app.db.rota.findMany({ select: { status: true, publishedAt: true } })).toEqual([
        { status: 'draft', publishedAt: null },
      ]);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('POST', publishPath(ownVenue, '2026-11-17'), { as: OWNER });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });

    it('creates no Rota', async () => {
      expect(await app.db.rota.count()).toBe(0);
    });
  });

  describe('when the Owner publishes a Draft Rota with a Shift', () => {
    let rota: { id: string };
    let sam: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      await createShift(app.db, { id: rota.id, venueId: ownVenue.id }, sam, {
        startsAt: '2026-11-16T09:00:00.000Z',
        endsAt: '2026-11-16T17:00:00.000Z',
      });
      app.setClock('2026-11-14T10:30:00.000Z');
      response = await app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER });
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });

    it('stores the Rota as Published, with when it was published', async () => {
      expect(
        await app.db.rota.findMany({ select: { id: true, status: true, publishedAt: true } }),
      ).toEqual([
        { id: rota.id, status: 'published', publishedAt: new Date('2026-11-14T10:30:00.000Z') },
      ]);
    });

    it('records who was notified about the Shift, and its times', async () => {
      expect(
        await app.db.shift.findMany({
          select: { notifiedStaffMemberId: true, notifiedStartsAt: true, notifiedEndsAt: true },
        }),
      ).toEqual([
        {
          notifiedStaffMemberId: sam.id,
          notifiedStartsAt: new Date('2026-11-16T09:00:00.000Z'),
          notifiedEndsAt: new Date('2026-11-16T17:00:00.000Z'),
        },
      ]);
    });

    describe('when the Owner opens that Week', () => {
      beforeEach(async () => {
        response = await app.request('GET', rotaPath(ownVenue, WEEK_START), { as: OWNER });
      });

      it('returns the Rota as Published, with its Shift not marked as changed', async () => {
        expect(await response.json()).toMatchObject({
          status: 'published',
          shifts: [{ startsAt: '2026-11-16T09:00:00.000Z', changed: false }],
        });
      });
    });

    describe('when the Owner opens the next Week', () => {
      beforeEach(async () => {
        response = await app.request('GET', rotaPath(ownVenue, '2026-11-23'), { as: OWNER });
      });

      it('returns a Draft Rota', async () => {
        expect(await response.json()).toMatchObject({ weekStart: '2026-11-23', status: 'draft' });
      });
    });

    describe('when the Owner publishes it again', () => {
      let firstPublishedAt: Date | null;

      beforeEach(async () => {
        ({ publishedAt: firstPublishedAt } = await app.db.rota.findUniqueOrThrow({
          where: { id: rota.id },
        }));
        response = await app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER });
      });

      it('responds with 409 and the rota_already_published code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'rota_already_published' },
        ]);
      });

      it('keeps when it was first published', async () => {
        expect(
          await app.db.rota.findUniqueOrThrow({
            where: { id: rota.id },
            select: { publishedAt: true },
          }),
        ).toEqual({ publishedAt: firstPublishedAt });
      });
    });
  });

  describe('when the Owner publishes a Week that has not been opened', () => {
    beforeEach(async () => {
      response = await app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER });
    });

    it('responds with 200 and no Staff Members to notify', async () => {
      expect([response.status, await response.json()]).toEqual([200, { staffMembers: [] }]);
    });

    it('stores a Published Rota for that Week', async () => {
      expect(
        await app.db.rota.findMany({ select: { venueId: true, weekStart: true, status: true } }),
      ).toEqual([
        {
          venueId: ownVenue.id,
          weekStart: new Date('2026-11-16T00:00:00.000Z'),
          status: 'published',
        },
      ]);
    });
  });

  describe('when the Owner publishes the same Draft Rota from two tabs at once', () => {
    let responses: Response[];

    beforeEach(async () => {
      const rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      const sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      await createShift(app.db, { id: rota.id, venueId: ownVenue.id }, sam, MONDAY_9_TO_5);
      responses = await Promise.all([
        app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER }),
        app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER }),
      ]);
    });

    it('accepts one and responds to the other with 409', () => {
      expect(responses.map((each) => each.status).sort()).toEqual([200, 409]);
    });

    it('lists Sam to notify once, in the accepted response', async () => {
      const results = (await Promise.all(responses.map((each) => each.json()))) as Partial<PublishResult>[];
      expect(results.flatMap(({ staffMembers = [] }) => staffMembers.map(({ name }) => name))).toEqual([
        SAM.name,
      ]);
    });
  });

  describe('when Sam and Jo have Shifts that Week, Alex has none, and Pat has one but is archived', () => {
    let sam: { id: string };
    let jo: { id: string };

    beforeEach(async () => {
      const rota = await createRotaFor(app.db, ownVenue, WEEK_START);
      const inRota = { id: rota.id, venueId: ownVenue.id };
      sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      jo = await createActiveStaffMember(app.db, ownVenue, JO);
      await createActiveStaffMember(app.db, ownVenue, ALEX);
      const pat = await createArchivedStaffMember(app.db, ownVenue, PAT);
      await createShift(app.db, inRota, sam, MONDAY_9_TO_5);
      await createShift(app.db, inRota, sam, TUESDAY_9_TO_5);
      await createShift(app.db, inRota, jo, TUESDAY_9_TO_5);
      await createShift(app.db, inRota, pat, MONDAY_9_TO_5);
    });

    describe('when the Owner publishes it', () => {
      let result: PublishResult;

      beforeEach(async () => {
        response = await app.request('POST', publishPath(ownVenue, WEEK_START), { as: OWNER });
        result = (await response.json()) as PublishResult;
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('lists only Jo and Sam to notify, by name', () => {
        expect(result.staffMembers.map(({ staffMemberId, name }) => ({ staffMemberId, name }))).toEqual([
          { staffMemberId: jo.id, name: JO.name },
          { staffMemberId: sam.id, name: SAM.name },
        ]);
      });

      it("gives Sam's Staff Link token", async () => {
        expect(result.staffMembers.find(({ name }) => name === SAM.name)?.staffLinkToken).toBe(
          await staffLinkTokenOf(app, ownVenue, sam),
        );
      });

      it("gives Jo's Staff Link token", async () => {
        expect(result.staffMembers.find(({ name }) => name === JO.name)?.staffLinkToken).toBe(
          await staffLinkTokenOf(app, ownVenue, jo),
        );
      });

      it('sends no email', () => {
        expect(app.outbox.sent).toEqual([]);
      });

      it('keeps the Staff Link tokens out of the log', () => {
        expect(
          result.staffMembers.filter(({ staffLinkToken }) => app.logs().includes(staffLinkToken)),
        ).toEqual([]);
      });
    });
  });
});
