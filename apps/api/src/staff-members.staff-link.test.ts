import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createActiveStaffMember, createUser, createVenueFor } from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };

function staffLinkPath(venue: { id: string }, staffMember: { id: string }) {
  return `/api/venues/${venue.id}/staff-members/${staffMember.id}/staff-link`;
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

describe('GET /api/venues/:venueId/staff-members/:staffMemberId/staff-link', () => {
  let app: TestApp;
  let response: Response;
  let venue: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
  });

  afterEach(() => app.close());

  describe('when the Owner opens the Staff Link of a Staff Member they added', () => {
    let sam: { id: string };
    let token: string;

    beforeEach(async () => {
      const added = await app.request('POST', `/api/venues/${venue.id}/staff-members`, {
        as: OWNER,
        body: SAM,
      });
      sam = (await added.json()) as { id: string };
      response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
      ({ token } = (await response.clone().json()) as { token: string });
    });

    it('responds with 200 and a URL-safe token of at least 32 bytes', () => {
      expect([response.status, Buffer.from(token, 'base64url').length >= 32]).toEqual([
        200,
        true,
      ]);
    });

    it('stores the SHA-256 hash of the token for lookup', async () => {
      expect(
        await app.db.staffMember.findUniqueOrThrow({
          where: { id: sam.id },
          select: { staffLinkTokenHash: true },
        }),
      ).toEqual({ staffLinkTokenHash: sha256Hex(token) });
    });

    it('never stores the plain token', async () => {
      const [row] = await app.db.$queryRaw<object[]>`SELECT * FROM staff_members`;
      expect(JSON.stringify(row)).not.toContain(token);
    });

    describe('when the Owner opens it again', () => {
      beforeEach(async () => {
        response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
      });

      it('returns the same token', async () => {
        expect(await response.json()).toEqual({ token });
      });
    });
  });

  describe('when the Staff Member was added before Staff Links existed', () => {
    let sam: { id: string };

    beforeEach(async () => {
      sam = await createActiveStaffMember(app.db, venue, SAM);
    });

    describe('when the Owner opens their Staff Link', () => {
      let token: string;

      beforeEach(async () => {
        response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
        ({ token } = (await response.clone().json()) as { token: string });
      });

      it('responds with 200', () => {
        expect(response.status).toBe(200);
      });

      it('stores a Staff Link for them', async () => {
        expect(
          await app.db.staffMember.findUniqueOrThrow({
            where: { id: sam.id },
            select: { staffLinkTokenHash: true },
          }),
        ).toEqual({ staffLinkTokenHash: sha256Hex(token) });
      });

      describe('when the Owner opens it again', () => {
        beforeEach(async () => {
          response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
        });

        it('returns the same token', async () => {
          expect(await response.json()).toEqual({ token });
        });
      });
    });
  });
});
