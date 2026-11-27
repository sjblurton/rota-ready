import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createArchivedStaffMember,
  createUser,
  createVenueFor,
  moveVenueToPreview,
  moveVenueToPro,
} from '#test/seed.js';
import { startTestApp, type TestApp, type VenueLock } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};

const ALEX = { name: 'Alex Smith', role: 'Bar', email: 'alex@example.com', phone: null };
const JO = { name: 'Jo Bloggs', role: 'Floor', email: 'jo@example.com', phone: null };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' };

describe('/api/venues/:venueId/staff-members', () => {
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

  function staffMembersPath(venue: { id: string }) {
    return `/api/venues/${venue.id}/staff-members`;
  }

  async function createActiveStaffMembers(venue: { id: string }, count: number) {
    for (let number = 1; number <= count; number++) {
      await createActiveStaffMember(app.db, venue, {
        name: `Staff Member ${number}`,
        role: 'Bar',
        email: `staff-${number}@example.com`,
        phone: null,
      });
    }
  }

  describe.each([
    { method: 'POST', route: '/staff-members' },
  ] as const)('$method $route', ({ method, route }) => {
    let ownStaffMemberId: string;
    let otherStaffMemberId: string;

    beforeEach(async () => {
      ownStaffMemberId = (await createActiveStaffMember(app.db, ownVenue, ALEX)).id;
      otherStaffMemberId = (
        await createActiveStaffMember(app.db, otherVenue, SAM)
      ).id;
    });

    function send(venue: { id: string }, staffMemberId: string, as?: typeof OWNER) {
      const path = `/api/venues/${venue.id}${route.replace(':staffMemberId', staffMemberId)}`;
      return app.request(method, path, {
        ...(as && { as }),
        body: { ...ALEX, name: 'Taken Over' },
      });
    }

    describe('when no token is sent', () => {
      beforeEach(async () => {
        response = await send(ownVenue, ownStaffMemberId);
      });

      it('responds with 401', () => {
        expect(response.status).toBe(401);
      });
    });

    describe('when a member of another venue requests it', () => {
      beforeEach(async () => {
        response = await send(otherVenue, otherStaffMemberId, OWNER);
      });

      it('responds with 404', () => {
        expect(response.status).toBe(404);
      });

      it('carries the not_found code', async () => {
        expect(await response.json()).toEqual({ code: 'not_found' });
      });

      it("leaves the other venue's Staff Members unchanged", async () => {
        expect(
          await app.db.staffMember.findMany({
            where: { venueId: otherVenue.id },
            select: { name: true, archivedAt: true },
          }),
        ).toEqual([{ name: SAM.name, archivedAt: null }]);
      });
    });
  });

  describe('POST /api/venues/:venueId/staff-members', () => {
    describe('when the Owner adds a Staff Member with an email and a blank phone number', () => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: { name: '  Alex Smith ', role: ' Bar ', email: ' Alex@Example.com ', phone: '' },
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the Staff Member trimmed, with the email lowercased and no phone', async () => {
        expect(await response.json()).toEqual({ id: expect.any(String), ...ALEX });
      });

      it('stores the Staff Member in the venue', async () => {
        expect(
          await app.db.staffMember.findMany({
            select: { venueId: true, name: true, role: true, email: true, phone: true },
          }),
        ).toEqual([{ venueId: ownVenue.id, ...ALEX }]);
      });

      it('gives them a Staff Link, stored as a hash and an encrypted copy', async () => {
        expect(
          await app.db.staffMember.findMany({
            select: { staffLinkTokenHash: true, staffLinkTokenCiphertext: true },
          }),
        ).toEqual([
          {
            staffLinkTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            staffLinkTokenCiphertext: expect.any(String),
          },
        ]);
      });
    });

    describe('when the Owner adds a Staff Member with an email and a phone number', () => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: SAM,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });

      it('returns the Staff Member with both', async () => {
        expect(await response.json()).toEqual({ id: expect.any(String), ...SAM });
      });
    });

    describe('when another active Staff Member in the venue already has the email', () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, ownVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: { ...SAM, email: 'ALEX@example.com' },
        });
      });

      it('responds with 409', () => {
        expect(response.status).toBe(409);
      });

      it('carries the staff_member_email_taken code', async () => {
        expect(await response.json()).toEqual({ code: 'staff_member_email_taken' });
      });

      it('creates no second Staff Member', async () => {
        expect(await app.db.staffMember.count()).toBe(1);
      });
    });

    describe('when only an archived Staff Member in the venue has the email', () => {
      beforeEach(async () => {
        await createArchivedStaffMember(app.db, ownVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: ALEX,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when a Staff Member in another venue has the email', () => {
      beforeEach(async () => {
        await createActiveStaffMember(app.db, otherVenue, ALEX);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: ALEX,
        });
      });

      it('responds with 201', () => {
        expect(response.status).toBe(201);
      });
    });

    describe('when the Venue has 14 active Staff Members', () => {
      beforeEach(async () => {
        await createActiveStaffMembers(ownVenue, 14);
      });

      describe('when the Owner adds a 15th', () => {
        beforeEach(async () => {
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('responds with 201', () => {
          expect(response.status).toBe(201);
        });
      });

      describe('when another request adds a 15th while the Owner adds one', () => {
        let lock: VenueLock;

        beforeEach(async () => {
          lock = await app.holdVenueLock(ownVenue.id);
          const pending = app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
          await lock.waitForBlockedRequest();
          await lock.commitAfter((tx) =>
            tx.staffMember.create({ data: { ...SAM, venueId: ownVenue.id } }),
          );
          response = await pending;
        });

        it('refuses the Owner with 409 and the staff_member_limit_reached code', async () => {
          expect([response.status, await response.json()]).toEqual([
            409,
            { code: 'staff_member_limit_reached' },
          ]);
        });

        it('leaves the Venue with 15 Staff Members on its list', async () => {
          const list = await app.request('GET', staffMembersPath(ownVenue), { as: OWNER });
          expect(await list.json()).toHaveLength(15);
        });
      });

      describe('when the Venue also has archived Staff Members', () => {
        beforeEach(async () => {
          await createArchivedStaffMember(app.db, ownVenue, JO);
          await createArchivedStaffMember(app.db, ownVenue, SAM);
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('adds the 15th, because archived Staff Members do not count', () => {
          expect(response.status).toBe(201);
        });
      });
    });

    describe('when the Venue has 15 active Staff Members', () => {
      let jo: { id: string };

      beforeEach(async () => {
        await createActiveStaffMembers(ownVenue, 14);
        jo = await createActiveStaffMember(app.db, ownVenue, JO);
      });

      describe('when the Owner adds a 16th', () => {
        beforeEach(async () => {
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('responds with 409', () => {
          expect(response.status).toBe(409);
        });

        it('carries the staff_member_limit_reached code', async () => {
          expect(await response.json()).toEqual({ code: 'staff_member_limit_reached' });
        });

        it('creates no Staff Member', async () => {
          expect(await app.db.staffMember.count({ where: { venueId: ownVenue.id } })).toBe(15);
        });
      });

      describe('when the Venue is on Pro and the Owner adds a 16th', () => {
        beforeEach(async () => {
          await moveVenueToPro(app.db, ownVenue);
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('refuses the Owner with 409 and the staff_member_limit_reached code, as on Free', async () => {
          expect([response.status, await response.json()]).toEqual([
            409,
            { code: 'staff_member_limit_reached' },
          ]);
        });
      });

      describe('when the Venue is on Preview and the Owner adds a 16th', () => {
        beforeEach(async () => {
          await moveVenueToPreview(app.db, ownVenue);
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('refuses the Owner with 409 and the staff_member_limit_reached code, as on Free', async () => {
          expect([response.status, await response.json()]).toEqual([
            409,
            { code: 'staff_member_limit_reached' },
          ]);
        });
      });

      describe('when the Owner adds back someone archived', () => {
        beforeEach(async () => {
          await createArchivedStaffMember(app.db, ownVenue, ALEX);
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('refuses them like anyone new, with the staff_member_limit_reached code', async () => {
          expect([response.status, await response.json()]).toEqual([
            409,
            { code: 'staff_member_limit_reached' },
          ]);
        });
      });

      describe('when the Owner archives Jo and then adds a Staff Member', () => {
        beforeEach(async () => {
          await app.request('POST', `${staffMembersPath(ownVenue)}/${jo.id}/archive`, { as: OWNER });
          response = await app.request('POST', staffMembersPath(ownVenue), {
            as: OWNER,
            body: ALEX,
          });
        });

        it('responds with 201', () => {
          expect(response.status).toBe(201);
        });
      });
    });

    describe('when the Venue already has 20 active Staff Members', () => {
      beforeEach(async () => {
        await createActiveStaffMembers(ownVenue, 20);
        response = await app.request('POST', staffMembersPath(ownVenue), {
          as: OWNER,
          body: ALEX,
        });
      });

      it('refuses the 21st with 409 and the staff_member_limit_reached code', async () => {
        expect([response.status, await response.json()]).toEqual([
          409,
          { code: 'staff_member_limit_reached' },
        ]);
      });
    });

    describe.each([
      { scenario: 'a blank email', body: { ...SAM, email: '  ' } },
      { scenario: 'no email', body: { name: SAM.name, role: SAM.role, phone: SAM.phone } },
      { scenario: 'a blank name', body: { ...ALEX, name: ' ' } },
      { scenario: 'a blank Role', body: { ...ALEX, role: '' } },
      { scenario: 'an invalid email', body: { ...ALEX, email: 'alex-at-example' } },
      { scenario: 'a phone number with letters', body: { ...SAM, phone: 'call me' } },
    ])('when the Owner sends $scenario', ({ body }) => {
      beforeEach(async () => {
        response = await app.request('POST', staffMembersPath(ownVenue), { as: OWNER, body });
      });

      it('responds with 400', () => {
        expect(response.status).toBe(400);
      });

      it('carries the invalid_request code', async () => {
        expect(await response.json()).toEqual({ code: 'invalid_request' });
      });

      it('creates no Staff Member', async () => {
        expect(await app.db.staffMember.count()).toBe(0);
      });
    });
  });
});
