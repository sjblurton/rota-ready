import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, createVenueFor } from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };

function staffLinkPath(venue: { id: string }, staffMember: { id: string }) {
  return `/api/venues/${venue.id}/staff-members/${staffMember.id}/staff-link`;
}

describe('POST /api/venues/:venueId/staff-members/:staffMemberId/staff-link/regenerate', () => {
  let app: TestApp;
  let response: Response;
  let venue: { id: string };
  let sam: { id: string };
  let oldToken: string;

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    const added = await app.request('POST', `/api/venues/${venue.id}/staff-members`, {
      as: OWNER,
      body: SAM,
    });
    sam = (await added.json()) as { id: string };
    const link = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
    ({ token: oldToken } = (await link.json()) as { token: string });
  });

  afterEach(() => app.close());

  describe('when the Owner regenerates the Staff Link', () => {
    let newToken: string;

    beforeEach(async () => {
      response = await app.request('POST', `${staffLinkPath(venue, sam)}/regenerate`, {
        as: OWNER,
      });
      ({ token: newToken } = (await response.clone().json()) as { token: string });
    });

    it('responds with 200 and a new token', () => {
      expect([response.status, newToken === oldToken]).toEqual([200, false]);
    });

    it('opens the Staff Link page with the new token', async () => {
      const page = await app.request('GET', `/api/staff-links/${newToken}`);
      expect(page.status).toBe(200);
    });

    describe('when the Owner opens the Staff Link again', () => {
      beforeEach(async () => {
        response = await app.request('GET', staffLinkPath(venue, sam), { as: OWNER });
      });

      it('returns the new token', async () => {
        expect(await response.json()).toEqual({ token: newToken });
      });
    });
  });
});
