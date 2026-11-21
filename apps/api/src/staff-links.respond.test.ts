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
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const WEDNESDAY_NOON = '2026-11-18T12:00:00.000Z';
const THURSDAY_9_TO_5 = {
  startsAt: '2026-11-19T09:00:00.000Z',
  endsAt: '2026-11-19T17:00:00.000Z',
};

function responsePath(token: string, shift: { id: string }) {
  return `/api/staff-links/${token}/shifts/${shift.id}/response`;
}

function storedResponse(app: TestApp, shift: { id: string }) {
  return app.db.shift.findUnique({
    where: { id: shift.id },
    select: { response: true, declineReason: true, respondedAt: true },
  });
}

describe('PUT /api/staff-links/:token/shifts/:shiftId/response', () => {
  let app: TestApp;
  let response: Response;
  let venue: { id: string };
  let sam: { id: string };
  let token: string;
  let published: { id: string; venueId: string };
  let thursday: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    app.setClock(WEDNESDAY_NOON);
    await createUser(app.db, OWNER);
    venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    const added = await app.request('POST', `/api/venues/${venue.id}/staff-members`, {
      as: OWNER,
      body: SAM,
    });
    sam = (await added.json()) as { id: string };
    const link = await app.request(
      'GET',
      `/api/venues/${venue.id}/staff-members/${sam.id}/staff-link`,
      { as: OWNER },
    );
    ({ token } = (await link.json()) as { token: string });
    published = await createPublishedRotaFor(app.db, venue, '2026-11-16');
    thursday = await createShift(app.db, published, sam, THURSDAY_9_TO_5);
  });

  afterEach(() => app.close());

  describe('when Sam Confirms their Thursday Shift', () => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath(token, thursday), {
        body: { response: 'confirmed' },
      });
    });

    it('responds with 200 and the Confirmed Shift', async () => {
      expect([response.status, await response.json()]).toEqual([
        200,
        {
          id: thursday.id,
          ...THURSDAY_9_TO_5,
          response: 'confirmed',
          declineReason: null,
          started: false,
        },
      ]);
    });

    it('stores the Shift Response with the time Sam answered', async () => {
      expect(await storedResponse(app, thursday)).toEqual({
        response: 'confirmed',
        declineReason: null,
        respondedAt: new Date(WEDNESDAY_NOON),
      });
    });

    it('never writes the token to the logs', () => {
      expect(app.logs()).not.toContain(token);
    });

    describe('when Sam changes their mind and Declines it with a reason', () => {
      beforeEach(async () => {
        response = await app.request('PUT', responsePath(token, thursday), {
          body: { response: 'declined', declineReason: 'Dentist' },
        });
      });

      it('stores the Decline in place of the Confirm', async () => {
        expect(await storedResponse(app, thursday)).toMatchObject({
          response: 'declined',
          declineReason: 'Dentist',
        });
      });
    });
  });

  describe('when Sam Declines their Thursday Shift with a reason', () => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath(token, thursday), {
        body: { response: 'declined', declineReason: '  Dentist appointment  ' },
      });
    });

    it('responds with 200 and the Declined Shift with the trimmed Decline Reason', async () => {
      expect([response.status, await response.json()]).toEqual([
        200,
        {
          id: thursday.id,
          ...THURSDAY_9_TO_5,
          response: 'declined',
          declineReason: 'Dentist appointment',
          started: false,
        },
      ]);
    });

    describe('when the Owner opens that Week', () => {
      beforeEach(async () => {
        response = await app.request('GET', `/api/venues/${venue.id}/rotas/2026-11-16`, {
          as: OWNER,
        });
      });

      it('shows the Shift as Declined with the Decline Reason', async () => {
        expect(await response.json()).toMatchObject({
          shifts: [{ id: thursday.id, response: 'declined', declineReason: 'Dentist appointment' }],
        });
      });
    });

    describe('when Sam changes their mind and Confirms it', () => {
      beforeEach(async () => {
        response = await app.request('PUT', responsePath(token, thursday), {
          body: { response: 'confirmed' },
        });
      });

      it('stores the Confirm and clears the Decline Reason', async () => {
        expect(await storedResponse(app, thursday)).toMatchObject({
          response: 'confirmed',
          declineReason: null,
        });
      });
    });
  });

  describe('when Sam Declines their Thursday Shift without a reason', () => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath(token, thursday), {
        body: { response: 'declined' },
      });
    });

    it('stores the Decline with no Decline Reason', async () => {
      expect(await storedResponse(app, thursday)).toMatchObject({
        response: 'declined',
        declineReason: null,
      });
    });
  });

  describe.each([
    {
      scenario: 'the Decline Reason is over 200 characters',
      body: { response: 'declined', declineReason: 'x'.repeat(201) },
    },
    { scenario: 'the Shift Response is not Confirmed or Declined', body: { response: 'pending' } },
  ])('when $scenario', ({ body }) => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath(token, thursday), { body });
    });

    it('responds with 400 and the invalid_request code', async () => {
      expect([response.status, await response.json()]).toEqual([
        400,
        { code: 'invalid_request' },
      ]);
    });

    it('leaves the Shift Pending', async () => {
      expect(await storedResponse(app, thursday)).toEqual({
        response: 'pending',
        declineReason: null,
        respondedAt: null,
      });
    });
  });

  describe('when the Shift started at noon', () => {
    let started: { id: string };

    beforeEach(async () => {
      started = await createShift(app.db, published, sam, {
        startsAt: WEDNESDAY_NOON,
        endsAt: '2026-11-18T18:00:00.000Z',
      });
      response = await app.request('PUT', responsePath(token, started), {
        body: { response: 'declined', declineReason: 'Ill' },
      });
    });

    it('responds with 409 and the shift_started code', async () => {
      expect([response.status, await response.json()]).toEqual([409, { code: 'shift_started' }]);
    });

    it('leaves the Shift Pending', async () => {
      expect(await storedResponse(app, started)).toMatchObject({ response: 'pending' });
    });
  });

  describe("when Sam answers Jo's Shift", () => {
    let josShift: { id: string };

    beforeEach(async () => {
      const jo = await createActiveStaffMember(app.db, venue, JO);
      josShift = await createShift(app.db, published, jo, THURSDAY_9_TO_5);
      response = await app.request('PUT', responsePath(token, josShift), {
        body: { response: 'declined' },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it("leaves Jo's Shift Pending", async () => {
      expect(await storedResponse(app, josShift)).toMatchObject({ response: 'pending' });
    });
  });

  describe("when Sam answers a Shift in next Week's Draft Rota", () => {
    let draftShift: { id: string };

    beforeEach(async () => {
      const draft = await createRotaFor(app.db, venue, '2026-11-23');
      draftShift = await createShift(app.db, draft, sam, {
        startsAt: '2026-11-23T09:00:00.000Z',
        endsAt: '2026-11-23T17:00:00.000Z',
      });
      response = await app.request('PUT', responsePath(token, draftShift), {
        body: { response: 'confirmed' },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('leaves the Draft Shift Pending', async () => {
      expect(await storedResponse(app, draftShift)).toMatchObject({ response: 'pending' });
    });
  });

  describe("when another venue's Shift is sent through Sam's Staff Link", () => {
    let theirShift: { id: string };

    beforeEach(async () => {
      await createUser(app.db, OTHER_OWNER);
      const otherVenue = await createVenueFor(app.db, OTHER_OWNER, {
        name: 'The Anchor',
        timeZone: 'Europe/London',
      });
      const pat = await createActiveStaffMember(app.db, otherVenue, {
        name: 'Pat Other',
        role: 'Bar',
        email: 'pat@example.com',
        phone: null,
      });
      const theirRota = await createPublishedRotaFor(app.db, otherVenue, '2026-11-16');
      theirShift = await createShift(app.db, theirRota, pat, THURSDAY_9_TO_5);
      response = await app.request('PUT', responsePath(token, theirShift), {
        body: { response: 'confirmed' },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it("leaves the other venue's Shift Pending", async () => {
      expect(await storedResponse(app, theirShift)).toMatchObject({ response: 'pending' });
    });
  });

  describe.each([
    { scenario: 'the token is unknown', body: { response: 'confirmed' } },
    { scenario: 'the token is unknown and the body is not valid', body: { response: 'maybe' } },
  ])('when $scenario', ({ body }) => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath('not-a-real-token', thursday), { body });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when Sam has been archived', () => {
    beforeEach(async () => {
      await app.db.staffMember.update({
        where: { id: sam.id },
        data: { archivedAt: new Date(), email: null },
      });
      response = await app.request('PUT', responsePath(token, thursday), {
        body: { response: 'confirmed' },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });

  describe('when the Shift ID is not a UUID', () => {
    beforeEach(async () => {
      response = await app.request('PUT', responsePath(token, { id: 'abc' }), {
        body: { response: 'confirmed' },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });
  });
});
