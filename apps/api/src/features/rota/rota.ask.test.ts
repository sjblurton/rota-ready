import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createActiveStaffMember,
  createPublishedRotaFor,
  createShift,
  createUser,
  createVenueFor,
  moveVenueToPreview,
  moveVenueToPro,
} from '#test/seed.js';
import { Plan } from '#src/generated/prisma/client.js';
import { startTestApp, type TestApp } from '#test/test-app.js';

const OWNER = { id: '2f1b6f0e-6a3c-4d39-9a4e-0c8f3b1d2e5a', email: 'owner@example.com' };
const OTHER_OWNER = {
  id: '7c0d9a54-1e2b-4f3a-8b6c-5d4e3f2a1b0c',
  email: 'other@example.com',
};
const WEEK_START = '2026-11-16';
const SAM = { name: 'Sam Jones', role: 'Kitchen', email: 'sam@example.com', phone: '07700 900123' };
const FRIDAY_NIGHT = {
  startsAt: '2026-11-20T20:00:00.000Z',
  endsAt: '2026-11-21T02:00:00.000Z',
  role: 'Bar',
};
const QUESTION = "Who's working Friday night?";

interface ParsedEvent {
  event: string;
  data: unknown;
}

function askPath(venue: { id: string }, weekStart = WEEK_START) {
  return `/api/venues/${venue.id}/rotas/${weekStart}/ask`;
}

function eventsIn(body: string): ParsedEvent[] {
  return body
    .split('\n\n')
    .filter((frame) => frame.startsWith('event: '))
    .map((frame) => {
      const [, event = '', data = ''] = /^event: (.*)\ndata: (.*)$/.exec(frame) ?? [];
      return { event, data: JSON.parse(data) };
    });
}

function modelRequestOf(app: TestApp) {
  const [request] = app.answerModel.requests;
  if (!request) throw new Error('The model was not asked anything');
  return request;
}

async function readUntil(response: Response, text: string) {
  if (!response.body) throw new Error('The response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = '';
  while (!received.includes(text)) {
    const { value, done } = await reader.read();
    if (done) break;
    received += decoder.decode(value, { stream: true });
  }
  return received;
}

describe('POST /api/venues/:venueId/rotas/:weekStart/ask', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    await createUser(app.db, OTHER_OWNER);
    ownVenue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    otherVenue = await createVenueFor(app.db, OTHER_OWNER, {
      name: 'The Anchor',
      timeZone: 'Europe/London',
    });
    await moveVenueToPreview(app.db, ownVenue);
    await moveVenueToPreview(app.db, otherVenue);
  });

  afterEach(() => app.close());

  describe('when no token is sent', () => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(ownVenue), { body: { question: QUESTION } });
    });

    it('responds with 401', () => {
      expect(response.status).toBe(401);
    });
  });

  describe('when a member of another venue requests it', () => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(otherVenue), {
        as: OWNER,
        body: { question: QUESTION },
      });
    });

    it('responds with 404 and the not_found code', async () => {
      expect([response.status, await response.json()]).toEqual([404, { code: 'not_found' }]);
    });

    it('asks the model nothing', () => {
      expect(app.answerModel.requests).toEqual([]);
    });
  });

  describe('when the Week start is not a Monday', () => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(ownVenue, '2026-11-17'), {
        as: OWNER,
        body: { question: QUESTION },
      });
    });

    it('responds with 404', () => {
      expect(response.status).toBe(404);
    });
  });

  describe.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['over 500 characters', 'a'.repeat(501)],
  ])('when the question is %s', (_case, question) => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(ownVenue), { as: OWNER, body: { question } });
    });

    it('responds with 400 and the invalid_request code', async () => {
      expect([response.status, await response.json()]).toEqual([400, { code: 'invalid_request' }]);
    });
  });

  describe('when the question is exactly 500 characters', () => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: 'a'.repeat(500) },
      });
    });

    it('responds with 200', () => {
      expect(response.status).toBe(200);
    });
  });

  describe.each([
    ['Free', (venue: { id: string }) => app.db.venue.update({ where: { id: venue.id }, data: { plan: Plan.free } })],
    ['Pro', (venue: { id: string }) => moveVenueToPro(app.db, venue)],
  ])('when the Venue is on %s', (_plan, moveVenue) => {
    beforeEach(async () => {
      await moveVenue(ownVenue);
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: QUESTION },
      });
    });

    it('responds with 503 and the ask_unavailable code', async () => {
      expect([response.status, await response.json()]).toEqual([503, { code: 'ask_unavailable' }]);
    });
  });

  describe('when Sam has a Friday night Shift and the Owner asks who is working', () => {
    let body: string;
    let sam: { id: string };
    let shift: { id: string };

    beforeEach(async () => {
      const rota = await createPublishedRotaFor(app.db, ownVenue, WEEK_START);
      sam = await createActiveStaffMember(app.db, ownVenue, SAM);
      shift = await createShift(app.db, rota, sam, FRIDAY_NIGHT);
      app.answerModel.answerWith(['Sam Jones ', 'is on Bar ', 'from 20:00.']);
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: `  ${QUESTION}  ` },
      });
      body = await response.text();
    });

    it('responds with 200 as an event stream', () => {
      expect([response.status, response.headers.get('content-type')]).toEqual([
        200,
        'text/event-stream; charset=utf-8',
      ]);
    });

    it('tells proxies not to buffer or cache the stream, and keeps the connection open', () => {
      expect(
        ['cache-control', 'x-accel-buffering', 'connection'].map((header) => response.headers.get(header)),
      ).toEqual(['no-cache, no-transform', 'no', 'keep-alive']);
    });

    it('streams each chunk as a delta, in order, then done', () => {
      expect(eventsIn(body)).toEqual([
        { event: 'delta', data: { text: 'Sam Jones ' } },
        { event: 'delta', data: { text: 'is on Bar ' } },
        { event: 'delta', data: { text: 'from 20:00.' } },
        { event: 'done', data: {} },
      ]);
    });

    it("asks the model the trimmed question about the Week's Shifts", () => {
      expect(modelRequestOf(app).prompt).toContain(
        `<question>\n${QUESTION}\n</question>`,
      );
    });

    it("gives the model Sam's Shift in the Venue's local time", () => {
      expect(modelRequestOf(app).prompt).toContain('- Fri 20 Nov, 20:00–02:00 (+1): Sam Jones (Bar)');
    });

    it('gives the model no email address, phone number or ID', () => {
      expect(
        [SAM.email, SAM.phone, ownVenue.id, sam.id, shift.id].filter((secret) =>
          modelRequestOf(app).prompt.includes(secret),
        ),
      ).toEqual([]);
    });
  });

  describe('when the Owner asks about a Week that has never been opened', () => {
    beforeEach(async () => {
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: QUESTION },
      });
      await response.text();
    });

    it('tells the model the Week has no Shifts', () => {
      expect(modelRequestOf(app).prompt).toContain('(no Shifts this Week)');
    });

    it('opens no Rota for that Week', async () => {
      expect(await app.db.rota.count({ where: { venueId: ownVenue.id } })).toBe(0);
    });
  });

  describe('when the model stream breaks after the first chunk', () => {
    let body: string;

    beforeEach(async () => {
      app.answerModel.failAfter(['Sam Jones ']);
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: QUESTION },
      });
      body = await response.text();
    });

    it('streams the chunk it had, then an error with the ask_failed code', () => {
      expect(eventsIn(body)).toEqual([
        { event: 'delta', data: { text: 'Sam Jones ' } },
        { event: 'error', data: { code: 'ask_failed' } },
      ]);
    });
  });

  describe('when the model goes quiet after the first chunk', () => {
    let received: string;

    beforeEach(async () => {
      app.answerModel.waitForAbortAfter(['Sam Jones ']);
      const disconnect = new AbortController();
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: QUESTION },
        signal: disconnect.signal,
      });
      received = await readUntil(response, ': ping\n\n');
      disconnect.abort();
    });

    it('sends a ping comment after the delta to keep the quiet connection open', () => {
      expect(received).toMatch(/^event: delta\ndata: \{"text":"Sam Jones "\}\n\n: ping\n\n/);
    });
  });

  describe('when the Owner disconnects after the first chunk', () => {
    beforeEach(async () => {
      app.answerModel.waitForAbortAfter(['Sam Jones ']);
      const disconnect = new AbortController();
      response = await app.request('POST', askPath(ownVenue), {
        as: OWNER,
        body: { question: QUESTION },
        signal: disconnect.signal,
      });
      await readUntil(response, 'Sam Jones ');
      disconnect.abort();
      await expect.poll(() => app.answerModel.requests[0]?.signal.aborted).toBe(true);
    });

    it('aborts the model stream', () => {
      expect(modelRequestOf(app).signal.aborted).toBe(true);
    });
  });
});

describe('POST /api/venues/:venueId/rotas/:weekStart/ask, limited per User', () => {
  let app: TestApp;
  let response: Response;
  let ownVenue: { id: string };
  let otherVenue: { id: string };

  async function askAt(instant: string, times: number, as = OWNER, venue = ownVenue) {
    app.setClock(instant);
    for (let asked = 0; asked < times; asked += 1) {
      response = await app.request('POST', askPath(venue), { as, body: { question: QUESTION } });
      await response.text();
    }
  }

  beforeEach(async () => {
    app = await startTestApp();
    await createUser(app.db, OWNER);
    await createUser(app.db, OTHER_OWNER);
    ownVenue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    otherVenue = await createVenueFor(app.db, OTHER_OWNER, {
      name: 'The Anchor',
      timeZone: 'Europe/London',
    });
    await moveVenueToPreview(app.db, ownVenue);
    await moveVenueToPreview(app.db, otherVenue);
  });

  afterEach(() => app.close());

  describe('when the Owner has asked 10 questions in the last 10 minutes', () => {
    beforeEach(async () => {
      await askAt('2026-01-05T12:00:00.000Z', 10);
    });

    it('answers the 10th', () => {
      expect(response.status).toBe(200);
    });

    describe('when they ask an 11th, 9 minutes 59 seconds after the first', () => {
      beforeEach(async () => {
        app.setClock('2026-01-05T12:09:59.000Z');
        response = await app.request('POST', askPath(ownVenue), { as: OWNER, body: { question: QUESTION } });
      });

      it('responds with 429 and the ask_rate_limited code', async () => {
        expect([response.status, await response.json()]).toEqual([429, { code: 'ask_rate_limited' }]);
      });

      it('asks the model nothing more', () => {
        expect(app.answerModel.requests).toHaveLength(10);
      });
    });

    describe('when they ask an 11th, just over 10 minutes after the first', () => {
      beforeEach(async () => {
        await askAt('2026-01-05T12:10:01.000Z', 1);
      });

      it('answers it', () => {
        expect(response.status).toBe(200);
      });
    });

    describe('when another Owner asks at the same moment', () => {
      beforeEach(async () => {
        await askAt('2026-01-05T12:05:00.000Z', 1, OTHER_OWNER, otherVenue);
      });

      it("answers them, because the first Owner's limit isn't theirs", () => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('when the Owner has asked 50 questions today, 10 at a time', () => {
    beforeEach(async () => {
      for (const instant of [
        '2026-01-05T12:00:00.000Z',
        '2026-01-05T12:11:00.000Z',
        '2026-01-05T12:22:00.000Z',
        '2026-01-05T12:33:00.000Z',
        '2026-01-05T12:44:00.000Z',
      ]) {
        await askAt(instant, 10);
      }
    });

    describe('when they ask a 51st, 11 minutes after the last 10', () => {
      beforeEach(async () => {
        app.setClock('2026-01-05T12:55:00.000Z');
        response = await app.request('POST', askPath(ownVenue), { as: OWNER, body: { question: QUESTION } });
      });

      it('responds with 429 and the ask_rate_limited code', async () => {
        expect([response.status, await response.json()]).toEqual([429, { code: 'ask_rate_limited' }]);
      });
    });

    describe('when they ask a 51st, just over a day after the first', () => {
      beforeEach(async () => {
        await askAt('2026-01-06T12:00:01.000Z', 1);
      });

      it('answers it', () => {
        expect(response.status).toBe(200);
      });
    });
  });
});

describe('POST /api/venues/:venueId/rotas/:weekStart/ask with no Anthropic API key', () => {
  let app: TestApp;
  let response: Response;

  beforeEach(async () => {
    app = await startTestApp({ withAnswerModel: false });
    await createUser(app.db, OWNER);
    const venue = await createVenueFor(app.db, OWNER, { name: 'The Crown', timeZone: 'Europe/London' });
    await moveVenueToPreview(app.db, venue);
    response = await app.request('POST', askPath(venue), { as: OWNER, body: { question: QUESTION } });
  });

  afterEach(() => app.close());

  it('responds with 503 and the ask_unavailable code', async () => {
    expect([response.status, await response.json()]).toEqual([503, { code: 'ask_unavailable' }]);
  });
});
