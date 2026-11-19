import { beforeEach, describe, expect, it } from 'vitest';
import { formatDate, formatLocalDate, formatShiftTimes, formatTime } from './date-time.js';

const london = { timeZone: 'Europe/London' };

describe('formatTime', () => {
  const summerEvening = new Date('2026-07-01T19:05:00Z');
  let formatted: string;

  describe('when given only a time zone', () => {
    beforeEach(() => {
      formatted = formatTime(summerEvening, london);
    });

    it('shows local time in en-GB on the 24-hour clock', () => {
      expect(formatted).toBe('20:05');
    });
  });

  describe('when given a different time zone', () => {
    beforeEach(() => {
      formatted = formatTime(summerEvening, { timeZone: 'America/New_York' });
    });

    it('shows the time in that zone', () => {
      expect(formatted).toBe('15:05');
    });
  });

  describe('when given a locale that defaults to a 12-hour clock', () => {
    beforeEach(() => {
      formatted = formatTime(summerEvening, { ...london, locale: 'en-US' });
    });

    it('still uses the 24-hour clock', () => {
      expect(formatted).toBe('20:05');
    });
  });

  describe('when the time is midnight', () => {
    beforeEach(() => {
      formatted = formatTime(new Date('2026-01-14T00:00:00Z'), london);
    });

    it('shows 00:00 rather than 24:00', () => {
      expect(formatted).toBe('00:00');
    });
  });
});

describe('formatDate', () => {
  let formatted: string;

  describe('when given only a time zone', () => {
    beforeEach(() => {
      formatted = formatDate(new Date('2026-03-29T09:00:00Z'), london);
    });

    it('shows the short weekday, day and month in en-GB', () => {
      expect(formatted).toBe('Sun 29 Mar');
    });
  });

  describe('when the instant falls on a different day in the given time zone', () => {
    beforeEach(() => {
      formatted = formatDate(new Date('2026-03-29T23:30:00Z'), {
        timeZone: 'Asia/Tokyo',
      });
    });

    it('shows the date in that zone', () => {
      expect(formatted).toBe('Mon 30 Mar');
    });
  });
});

describe('formatShiftTimes', () => {
  let formatted: string;

  describe('when the Shift starts and ends on the same day', () => {
    beforeEach(() => {
      formatted = formatShiftTimes(
        new Date('2026-07-01T08:00:00Z'),
        new Date('2026-07-01T16:00:00Z'),
        london,
      );
    });

    it('shows the start and end times', () => {
      expect(formatted).toBe('09:00–17:00');
    });
  });

  describe('when the Shift is an Overnight Shift', () => {
    beforeEach(() => {
      formatted = formatShiftTimes(
        new Date('2026-07-05T19:00:00Z'),
        new Date('2026-07-06T01:00:00Z'),
        london,
      );
    });

    it('marks the end as the next day', () => {
      expect(formatted).toBe('20:00–02:00 (+1)');
    });
  });

  describe('when the Shift crosses midnight in UTC but not in the given time zone', () => {
    beforeEach(() => {
      formatted = formatShiftTimes(
        new Date('2026-07-01T20:00:00Z'),
        new Date('2026-07-02T02:00:00Z'),
        { timeZone: 'America/New_York' },
      );
    });

    it('does not mark the end as the next day', () => {
      expect(formatted).toBe('16:00–22:00');
    });
  });

  describe.each([
    {
      scenario: 'a Shift is on the last Sunday of March, after the clocks go forward',
      timeZone: 'Europe/London',
      startsAt: '2026-03-29T09:00:00Z',
      endsAt: '2026-03-29T16:00:00Z',
      expected: '10:00–17:00',
    },
    {
      scenario: 'a Shift spans the clocks going forward on the last Sunday of March',
      timeZone: 'Europe/London',
      startsAt: '2026-03-28T22:00:00Z',
      endsAt: '2026-03-29T05:00:00Z',
      expected: '22:00–06:00 (+1)',
    },
    {
      scenario: 'a Shift is on the last Sunday of October, after the clocks go back',
      timeZone: 'Europe/London',
      startsAt: '2026-10-25T10:00:00Z',
      endsAt: '2026-10-25T17:00:00Z',
      expected: '10:00–17:00',
    },
    {
      scenario: 'a Shift spans the clocks going back on the last Sunday of October',
      timeZone: 'Europe/London',
      startsAt: '2026-10-24T21:00:00Z',
      endsAt: '2026-10-25T06:00:00Z',
      expected: '22:00–06:00 (+1)',
    },
    {
      scenario: 'a Shift spans the clocks going forward on the last Sunday of March in Paris',
      timeZone: 'Europe/Paris',
      startsAt: '2026-03-28T21:00:00Z',
      endsAt: '2026-03-29T04:00:00Z',
      expected: '22:00–06:00 (+1)',
    },
    {
      scenario: 'a Shift spans the clocks going back on the last Sunday of October in Paris',
      timeZone: 'Europe/Paris',
      startsAt: '2026-10-24T20:00:00Z',
      endsAt: '2026-10-25T05:00:00Z',
      expected: '22:00–06:00 (+1)',
    },
  ])('when $scenario', ({ timeZone, startsAt, endsAt, expected }) => {
    beforeEach(() => {
      formatted = formatShiftTimes(new Date(startsAt), new Date(endsAt), { timeZone });
    });

    it(`shows ${expected} in ${timeZone} local time`, () => {
      expect(formatted).toBe(expected);
    });
  });
});

describe('formatLocalDate', () => {
  let formatted: string;

  describe('when given a local date', () => {
    beforeEach(() => {
      formatted = formatLocalDate('2026-11-16');
    });

    it('shows the short weekday, day and month', () => {
      expect(formatted).toBe('Mon 16 Nov');
    });
  });
});
