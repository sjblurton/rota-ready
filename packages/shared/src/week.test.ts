import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDays,
  isWeekStart,
  localDateOf,
  weekDays,
  weekStartOf,
  zonedTimeToUtc,
} from './week.js';

const LONDON = 'Europe/London';

describe('localDateOf', () => {
  let date: string;

  describe('when an instant is late evening UTC in summer', () => {
    beforeEach(() => {
      date = localDateOf(new Date('2026-07-01T23:30:00Z'), LONDON);
    });

    it('gives the next calendar day in London, which is an hour ahead', () => {
      expect(date).toBe('2026-07-02');
    });
  });
});

describe('weekStartOf', () => {
  let weekStart: string;

  describe.each([
    {
      scenario: 'a Sunday evening in London',
      instant: '2026-11-22T20:00:00Z',
      timeZone: LONDON,
      expected: '2026-11-16',
    },
    {
      scenario: 'just after midnight on a Monday in London',
      instant: '2026-06-21T23:30:00Z',
      timeZone: LONDON,
      expected: '2026-06-22',
    },
    {
      scenario: 'Monday morning in Auckland, still Sunday in UTC',
      instant: '2026-11-22T20:00:00Z',
      timeZone: 'Pacific/Auckland',
      expected: '2026-11-23',
    },
    {
      scenario: 'Sunday evening in Los Angeles, already Monday in UTC',
      instant: '2026-11-23T05:00:00Z',
      timeZone: 'America/Los_Angeles',
      expected: '2026-11-16',
    },
  ])('when the instant is $scenario', ({ instant, timeZone, expected }) => {
    beforeEach(() => {
      weekStart = weekStartOf(new Date(instant), timeZone);
    });

    it(`gives the Monday ${expected}`, () => {
      expect(weekStart).toBe(expected);
    });
  });
});

describe('weekDays', () => {
  let days: string[];

  describe('when a Week ends on the day the clocks go forward', () => {
    beforeEach(() => {
      days = weekDays('2026-03-23');
    });

    it('still lists seven consecutive days', () => {
      expect(days).toEqual([
        '2026-03-23',
        '2026-03-24',
        '2026-03-25',
        '2026-03-26',
        '2026-03-27',
        '2026-03-28',
        '2026-03-29',
      ]);
    });
  });

  describe('when a Week crosses the end of a month', () => {
    beforeEach(() => {
      days = weekDays('2026-03-30');
    });

    it('lists Monday to Sunday', () => {
      expect(days).toEqual([
        '2026-03-30',
        '2026-03-31',
        '2026-04-01',
        '2026-04-02',
        '2026-04-03',
        '2026-04-04',
        '2026-04-05',
      ]);
    });
  });
});

describe('addDays', () => {
  let date: string;

  describe('when stepping back a Week across a month boundary', () => {
    beforeEach(() => {
      date = addDays('2026-03-02', -7);
    });

    it('gives the previous Monday', () => {
      expect(date).toBe('2026-02-23');
    });
  });
});

describe('isWeekStart', () => {
  let result: boolean;

  describe.each([
    { scenario: 'a Monday', value: '2026-11-16', expected: true },
    { scenario: 'a Tuesday', value: '2026-11-17', expected: false },
    { scenario: 'a date that does not exist', value: '2026-02-30', expected: false },
    { scenario: 'a date in another format', value: '16/11/2026', expected: false },
  ])('when given $scenario', ({ value, expected }) => {
    beforeEach(() => {
      result = isWeekStart(value);
    });

    it(`returns ${expected}`, () => {
      expect(result).toBe(expected);
    });
  });
});

describe('zonedTimeToUtc', () => {
  let instant: Date;

  describe.each([
    { scenario: 'in winter', date: '2026-01-15', time: '18:00', expected: '2026-01-15T18:00:00.000Z' },
    { scenario: 'in summer', date: '2026-07-15', time: '18:00', expected: '2026-07-15T17:00:00.000Z' },
  ])('when the local time is $scenario', ({ date, time, expected }) => {
    beforeEach(() => {
      instant = zonedTimeToUtc(date, time, LONDON);
    });

    it(`gives ${expected}`, () => {
      expect(instant.toISOString()).toBe(expected);
    });
  });

  describe.each([
    {
      change: 'the clocks go forward on the last Sunday of March',
      date: '2026-03-29',
      afterChange: '2026-03-29T17:00:00.000Z',
      inChangedHour: '2026-03-29T01:30:00.000Z',
      changedHourMeaning: 'the skipped hour moves forward to 02:30 summer time',
    },
    {
      change: 'the clocks go back on the last Sunday of October',
      date: '2026-10-25',
      afterChange: '2026-10-25T18:00:00.000Z',
      inChangedHour: '2026-10-25T00:30:00.000Z',
      changedHourMeaning: 'the repeated hour takes its first, summer-time occurrence',
    },
  ])('on the day $change', ({ date, afterChange, inChangedHour, changedHourMeaning }) => {
    describe('when the time is 18:00', () => {
      beforeEach(() => {
        instant = zonedTimeToUtc(date, '18:00', LONDON);
      });

      it('uses the offset in force after the change', () => {
        expect(instant.toISOString()).toBe(afterChange);
      });
    });

    describe('when the time is 01:30, inside the hour that changes', () => {
      beforeEach(() => {
        instant = zonedTimeToUtc(date, '01:30', LONDON);
      });

      it(changedHourMeaning, () => {
        expect(instant.toISOString()).toBe(inChangedHour);
      });
    });
  });
});
