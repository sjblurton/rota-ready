import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUser, createVenueFor } from '../test/seed.js';
import { startTestApp, type TestApp } from '../test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: null };

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

    it('returns their first name and the Venue name', async () => {
      expect(await response.json()).toEqual({ firstName: 'Sam', venueName: 'The Crown' });
    });

    it('never writes the token to the logs', () => {
      expect([app.logs().includes('/api/staff-links/'), app.logs().includes(token)]).toEqual([
        true,
        false,
      ]);
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
