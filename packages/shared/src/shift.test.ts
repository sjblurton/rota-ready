import { beforeEach, describe, expect, it } from 'vitest';
import {
  quarterHourTimes,
  rotaSchema,
  shiftEndsAt,
  shiftFormSchema,
  shiftFormValues,
  shiftRequestSchema,
  shiftTimesIssue,
  shiftTimesOneWeekLater,
} from './shift.js';
import { zonedTimeToUtc } from './week.js';

const LONDON = 'Europe/London';
const HOUR_MS = 3_600_000;
const STAFF_MEMBER_ID = '6b3f1c2e-8d4a-4f5b-9c7e-1a2b3c4d5e6f';

describe('shiftEndsAt', () => {
  let startsAt: Date;
  let endsAt: Date;

  describe.each([
    {
      scenario: 'the end time is later the same day',
      date: '2026-07-15',
      start: '09:00',
      end: '17:00',
      hours: 8,
    },
    {
      scenario: 'the end time is earlier than the start time',
      date: '2026-07-15',
      start: '20:00',
      end: '02:00',
      hours: 6,
    },
    {
      scenario: 'the end time equals the start time',
      date: '2026-07-15',
      start: '09:00',
      end: '09:00',
      hours: 24,
    },
  ])('when $scenario', ({ date, start, end, hours }) => {
    beforeEach(() => {
      startsAt = zonedTimeToUtc(date, start, LONDON);
      endsAt = shiftEndsAt(date, start, end, LONDON);
    });

    it(`lasts ${hours} hours`, () => {
      expect(endsAt.getTime() - startsAt.getTime()).toBe(hours * HOUR_MS);
    });
  });

  describe.each([
    {
      change: 'the clocks go forward (last Sunday of March)',
      date: '2026-03-28',
      start: '20:00',
      end: '02:00',
      hours: 5,
    },
    {
      change: 'the clocks go back (last Sunday of October)',
      date: '2026-10-24',
      start: '22:00',
      end: '03:00',
      hours: 6,
    },
    {
      change: 'the repeated October hour, ending at the second 01:15',
      date: '2026-10-25',
      start: '01:30',
      end: '01:15',
      hours: 0.75,
    },
  ])('when an Overnight Shift spans $change', ({ date, start, end, hours }) => {
    beforeEach(() => {
      startsAt = zonedTimeToUtc(date, start, LONDON);
      endsAt = shiftEndsAt(date, start, end, LONDON);
    });

    it(`lasts ${hours} hours of real time`, () => {
      expect(endsAt.getTime() - startsAt.getTime()).toBe(hours * HOUR_MS);
    });
  });
});

describe('shiftTimesOneWeekLater', () => {
  const LONDON = 'Europe/London';
  let moved: { startsAt: Date; endsAt: Date };

  describe.each([
    {
      change: 'the clocks go forward in March',
      startsAt: '2026-03-23T18:00:00.000Z',
      endsAt: '2026-03-23T23:00:00.000Z',
      expected: { startsAt: '2026-03-30T17:00:00.000Z', endsAt: '2026-03-30T22:00:00.000Z' },
    },
    {
      change: 'the clocks go back in October',
      startsAt: '2026-10-19T17:00:00.000Z',
      endsAt: '2026-10-19T22:00:00.000Z',
      expected: { startsAt: '2026-10-26T18:00:00.000Z', endsAt: '2026-10-26T23:00:00.000Z' },
    },
  ])('when an 18:00–23:00 Shift moves a Week on across $change', ({ startsAt, endsAt, expected }) => {
    beforeEach(() => {
      moved = shiftTimesOneWeekLater({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) }, LONDON);
    });

    it('keeps it at 18:00–23:00 local time', () => {
      expect(moved).toEqual({ startsAt: new Date(expected.startsAt), endsAt: new Date(expected.endsAt) });
    });
  });

  describe('when an Overnight Shift moves onto the night the clocks go forward', () => {
    beforeEach(() => {
      moved = shiftTimesOneWeekLater(
        { startsAt: new Date('2026-03-21T20:00:00.000Z'), endsAt: new Date('2026-03-22T02:00:00.000Z') },
        LONDON,
      );
    });

    it('keeps it at 20:00–02:00 local time, an hour shorter', () => {
      expect(moved).toEqual({
        startsAt: new Date('2026-03-28T20:00:00.000Z'),
        endsAt: new Date('2026-03-29T01:00:00.000Z'),
      });
    });
  });

  describe('when a 01:30 start moves onto the night the clocks go forward, when 01:30 never happens', () => {
    beforeEach(() => {
      moved = shiftTimesOneWeekLater(
        { startsAt: new Date('2026-03-22T01:30:00.000Z'), endsAt: new Date('2026-03-22T05:00:00.000Z') },
        LONDON,
      );
    });

    it('starts it at 02:30, the same moment an hour later on the clock, and keeps the 05:00 end', () => {
      expect(moved).toEqual({
        startsAt: new Date('2026-03-29T01:30:00.000Z'),
        endsAt: new Date('2026-03-29T04:00:00.000Z'),
      });
    });
  });

  describe('when a 01:30 start moves onto the night the clocks go back, when 01:30 happens twice', () => {
    beforeEach(() => {
      moved = shiftTimesOneWeekLater(
        { startsAt: new Date('2026-10-18T00:30:00.000Z'), endsAt: new Date('2026-10-18T04:00:00.000Z') },
        LONDON,
      );
    });

    it('starts it at the first 01:30 and keeps the 05:00 end', () => {
      expect(moved).toEqual({
        startsAt: new Date('2026-10-25T00:30:00.000Z'),
        endsAt: new Date('2026-10-25T05:00:00.000Z'),
      });
    });
  });
});

describe('shiftTimesIssue', () => {
  const startsAt = new Date('2026-07-15T08:00:00Z');
  let issue: string | null;

  describe.each([
    { scenario: 'the end is before the start', hours: -1, expected: 'validation.shiftEndsBeforeStart' },
    { scenario: 'the end equals the start', hours: 0, expected: 'validation.shiftEndsBeforeStart' },
    { scenario: 'the Shift lasts exactly 16 hours', hours: 16, expected: null },
    { scenario: 'the Shift lasts 17 hours', hours: 17, expected: 'validation.shiftTooLong' },
  ])('when $scenario', ({ hours, expected }) => {
    beforeEach(() => {
      issue = shiftTimesIssue(startsAt, new Date(startsAt.getTime() + hours * HOUR_MS));
    });

    it(`returns ${expected ?? 'no issue'}`, () => {
      expect(issue).toBe(expected);
    });
  });
});

describe('shiftRequestSchema', () => {
  const staffMemberId = STAFF_MEMBER_ID;
  let result: ReturnType<typeof shiftRequestSchema.safeParse>;

  describe('when the times come from toISOString and last 8 hours', () => {
    beforeEach(() => {
      result = shiftRequestSchema.safeParse({
        staffMemberId,
        startsAt: new Date('2026-07-15T08:00:00Z').toISOString(),
        endsAt: new Date('2026-07-15T16:00:00Z').toISOString(),
      });
    });

    it('accepts them', () => {
      expect(result.success).toBe(true);
    });
  });

  describe('when the Shift lasts 17 hours', () => {
    beforeEach(() => {
      result = shiftRequestSchema.safeParse({
        staffMemberId,
        startsAt: '2026-07-15T06:00:00Z',
        endsAt: '2026-07-15T23:00:00Z',
      });
    });

    it('rejects it with the too-long key on endsAt', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['endsAt'], message: 'validation.shiftTooLong' }),
      ]);
    });
  });

  describe('when the start is not on a quarter hour', () => {
    beforeEach(() => {
      result = shiftRequestSchema.safeParse({
        staffMemberId,
        startsAt: '2026-07-15T08:10:00.000Z',
        endsAt: '2026-07-15T16:00:00.000Z',
      });
    });

    it('rejects it with the quarter-hour key on startsAt', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['startsAt'], message: 'validation.shiftQuarterHour' }),
      ]);
    });
  });

  describe('when the end has seconds', () => {
    beforeEach(() => {
      result = shiftRequestSchema.safeParse({
        staffMemberId,
        startsAt: '2026-07-15T08:00:00.000Z',
        endsAt: '2026-07-15T16:00:30.000Z',
      });
    });

    it('rejects it with the quarter-hour key on endsAt', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['endsAt'], message: 'validation.shiftQuarterHour' }),
      ]);
    });
  });
});

describe('shiftFormSchema', () => {
  const staffMemberId = STAFF_MEMBER_ID;
  const schema = shiftFormSchema(LONDON);
  let result: ReturnType<typeof schema.safeParse>;

  describe('when the form has a 20:00–02:00 Shift on a summer day', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '20:00',
        endTime: '02:00',
      });
    });

    it('gives the request body in UTC, ending the next morning', () => {
      expect(result.data).toEqual({
        staffMemberId,
        startsAt: '2026-07-15T19:00:00.000Z',
        endsAt: '2026-07-16T01:00:00.000Z',
        role: null,
        notes: null,
      });
    });
  });

  describe('when the form has a Role and notes with spaces around them', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '18:00',
        endTime: '23:00',
        role: '  Bar  ',
        notes: ' Cash up at close ',
      });
    });

    it('sends them trimmed', () => {
      expect(result.data).toMatchObject({ role: 'Bar', notes: 'Cash up at close' });
    });
  });

  describe('when the Role and notes are left blank', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '18:00',
        endTime: '23:00',
        role: '   ',
        notes: '',
      });
    });

    it('sends no Role and no notes', () => {
      expect(result.data).toMatchObject({ role: null, notes: null });
    });
  });

  describe.each([
    { field: 'role', value: 'B'.repeat(51), message: 'validation.staffMemberRoleTooLong' },
    { field: 'notes', value: 'N'.repeat(501), message: 'validation.shiftNotesTooLong' },
  ])('when the $field is longer than allowed', ({ field, value, message }) => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '18:00',
        endTime: '23:00',
        [field]: value,
      });
    });

    it('puts the too-long message on that field', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: [field], message }),
      ]);
    });
  });

  describe('when the form has a 17-hour Shift', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '06:00',
        endTime: '23:00',
      });
    });

    it('rejects it with the too-long key on the end time', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['endTime'], message: 'validation.shiftTooLong' }),
      ]);
    });
  });

  describe('when the end time equals the start time', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '09:00',
        endTime: '09:00',
      });
    });

    it('treats it as 24 hours and rejects it as too long', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['endTime'], message: 'validation.shiftTooLong' }),
      ]);
    });
  });

  describe('when no Staff Member or start time is chosen', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId: '',
        date: '2026-07-15',
        startTime: '',
        endTime: '17:00',
      });
    });

    it('marks both as required', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['staffMemberId'], message: 'validation.required' }),
        expect.objectContaining({ path: ['startTime'], message: 'validation.required' }),
      ]);
    });
  });

  describe('when the start time is not on a quarter hour', () => {
    beforeEach(() => {
      result = schema.safeParse({
        staffMemberId,
        date: '2026-07-15',
        startTime: '09:10',
        endTime: '17:00',
      });
    });

    it('rejects it with the quarter-hour key on the start time', () => {
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['startTime'], message: 'validation.shiftQuarterHour' }),
      ]);
    });
  });

  describe('when the Staff Member already has a Shift that day from 12:00 to 18:00', () => {
    const existing = {
      staffMemberId,
      startsAt: '2026-07-15T11:00:00.000Z',
      endsAt: '2026-07-15T17:00:00.000Z',
    };
    const schemaWithShift = shiftFormSchema(LONDON, [existing]);

    describe('when the new Shift overlaps it', () => {
      beforeEach(() => {
        result = schemaWithShift.safeParse({
          staffMemberId,
          date: '2026-07-15',
          startTime: '17:00',
          endTime: '22:00',
        });
      });

      it('rejects it with the overlap key on the form as a whole', () => {
        expect(result.error?.issues).toEqual([
          expect.objectContaining({ path: ['root'], message: 'validation.shiftOverlaps' }),
        ]);
      });
    });

    describe('when the new Shift starts as it ends', () => {
      beforeEach(() => {
        result = schemaWithShift.safeParse({
          staffMemberId,
          date: '2026-07-15',
          startTime: '18:00',
          endTime: '22:00',
        });
      });

      it('accepts it', () => {
        expect(result.success).toBe(true);
      });
    });

    describe('when the overlapping Shift is for another Staff Member', () => {
      beforeEach(() => {
        result = schemaWithShift.safeParse({
          staffMemberId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
          date: '2026-07-15',
          startTime: '17:00',
          endTime: '22:00',
        });
      });

      it('accepts it', () => {
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('shiftFormValues', () => {
  let values: ReturnType<typeof shiftFormValues>;

  describe('when an Overnight Shift runs from 20:00 to 02:00 on a summer evening', () => {
    beforeEach(() => {
      values = shiftFormValues(
        {
          staffMemberId: STAFF_MEMBER_ID,
          startsAt: '2026-07-15T19:00:00.000Z',
          endsAt: '2026-07-16T01:00:00.000Z',
          role: null,
          notes: null,
        },
        LONDON,
      );
    });

    it('gives its start day and wall-clock times in the Venue timezone', () => {
      expect(values).toEqual({
        staffMemberId: STAFF_MEMBER_ID,
        date: '2026-07-15',
        startTime: '20:00',
        endTime: '02:00',
        role: '',
        notes: '',
      });
    });
  });

  describe('when the Shift has a Role and notes', () => {
    beforeEach(() => {
      values = shiftFormValues(
        {
          staffMemberId: STAFF_MEMBER_ID,
          startsAt: '2026-07-15T17:00:00.000Z',
          endsAt: '2026-07-15T22:00:00.000Z',
          role: 'Bar',
          notes: 'Cash up at close',
        },
        LONDON,
      );
    });

    it('fills them in', () => {
      expect(values).toMatchObject({ role: 'Bar', notes: 'Cash up at close' });
    });
  });
});

describe('rotaSchema', () => {
  let success: boolean;

  describe('when weekStart is a Tuesday', () => {
    beforeEach(() => {
      success = rotaSchema.safeParse({ weekStart: '2026-11-17', status: 'draft', shifts: [] })
        .success;
    });

    it('rejects it', () => {
      expect(success).toBe(false);
    });
  });
});

describe('quarterHourTimes', () => {
  let times: string[];

  beforeEach(() => {
    times = quarterHourTimes();
  });

  it('lists all 96 quarter hours of the day', () => {
    expect(times).toHaveLength(96);
  });

  it('starts at midnight in 15-minute steps', () => {
    expect(times.slice(0, 3)).toEqual(['00:00', '00:15', '00:30']);
  });

  it('uses the 24-hour clock, ending at 23:45', () => {
    expect([times[52], times.at(-1)]).toEqual(['13:00', '23:45']);
  });
});
