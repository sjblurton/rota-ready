import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '#src/lib/clock.js';
import { serverClock } from './server-clock.js';

const FIXED_AT = '2026-11-16T08:00:00.000Z';

describe('serverClock', () => {
  describe('when a development server is given a fixed time', () => {
    let clock: Clock;

    beforeEach(() => {
      clock = serverClock({ NODE_ENV: 'development', CLOCK_FIXED_AT: FIXED_AT });
    });

    it('always reads that time', () => {
      expect([clock.now(), clock.now()]).toEqual([
        new Date(FIXED_AT),
        new Date(FIXED_AT),
      ]);
    });

    describe('when a caller changes the Date it was given', () => {
      beforeEach(() => {
        clock.now().setUTCFullYear(2000);
      });

      it('still reads the fixed time', () => {
        expect(clock.now()).toEqual(new Date(FIXED_AT));
      });
    });
  });

  describe.each([
    { scenario: 'production', NODE_ENV: 'production' },
    { scenario: 'a server with no NODE_ENV', NODE_ENV: undefined },
  ])('when $scenario is given a fixed time', ({ NODE_ENV }) => {
    it('refuses to start', () => {
      expect(() => serverClock({ NODE_ENV, CLOCK_FIXED_AT: FIXED_AT })).toThrow(
        'CLOCK_FIXED_AT is only accepted when NODE_ENV is development',
      );
    });
  });

  describe('when the fixed time is not a date and time', () => {
    it('refuses to start', () => {
      expect(() => serverClock({ NODE_ENV: 'development', CLOCK_FIXED_AT: 'Monday' })).toThrow(
        'CLOCK_FIXED_AT is not a date and time',
      );
    });
  });

  describe('when no fixed time is given', () => {
    let clock: Clock;

    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-03-01T12:00:00.000Z') });
      clock = serverClock({ NODE_ENV: 'production' });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads the system time', () => {
      expect(clock.now()).toEqual(new Date('2026-03-01T12:00:00.000Z'));
    });
  });
});
