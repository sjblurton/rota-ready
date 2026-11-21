import type { Shift } from '@rota-ready/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { layOutShifts, type ShiftInCell } from './shift-layout';

const SAM = 'a1b2c3d4-0000-4000-8000-000000000001';
const JO = 'a1b2c3d4-0000-4000-8000-000000000002';
const LONDON = 'Europe/London';

function shift(id: string, staffMemberId: string, startsAt: string, endsAt: string): Shift {
  return {
    id,
    staffMemberId,
    startsAt,
    endsAt,
    response: 'pending',
    declineReason: null,
    started: false,
  };
}

describe('layOutShifts', () => {
  let shiftsIn: (staffMemberId: string, day: string) => ShiftInCell[];

  describe('when a Shift starts and ends on the same day', () => {
    beforeEach(() => {
      shiftsIn = layOutShifts(
        [shift('day', SAM, '2026-11-16T09:00:00.000Z', '2026-11-16T17:00:00.000Z')],
        LONDON,
      );
    });

    it("shows it in the Staff Member's row on that day", () => {
      expect(shiftsIn(SAM, '2026-11-16')).toEqual([
        { shift: expect.objectContaining({ id: 'day' }), times: '09:00–17:00' },
      ]);
    });

    it("leaves other Staff Members' rows empty", () => {
      expect(shiftsIn(JO, '2026-11-16')).toEqual([]);
    });
  });

  describe('when an Overnight Shift starts on Tuesday and ends on Wednesday', () => {
    beforeEach(() => {
      shiftsIn = layOutShifts(
        [shift('overnight', SAM, '2026-11-17T20:00:00.000Z', '2026-11-18T02:00:00.000Z')],
        LONDON,
      );
    });

    it('shows it on Tuesday, marked (+1)', () => {
      expect(shiftsIn(SAM, '2026-11-17')).toEqual([
        { shift: expect.objectContaining({ id: 'overnight' }), times: '20:00–02:00 (+1)' },
      ]);
    });

    it('leaves Wednesday empty', () => {
      expect(shiftsIn(SAM, '2026-11-18')).toEqual([]);
    });
  });

  describe('when a Shift starts just after midnight in British Summer Time', () => {
    beforeEach(() => {
      shiftsIn = layOutShifts(
        [shift('early', SAM, '2026-07-12T23:30:00.000Z', '2026-07-13T07:30:00.000Z')],
        LONDON,
      );
    });

    it('shows it on the local day it starts', () => {
      expect(shiftsIn(SAM, '2026-07-13')).toEqual([
        { shift: expect.objectContaining({ id: 'early' }), times: '00:30–08:30' },
      ]);
    });

    it('leaves the UTC day before empty', () => {
      expect(shiftsIn(SAM, '2026-07-12')).toEqual([]);
    });
  });

  describe.each([
    {
      scenario: 'the clocks go forward on the last Sunday of March',
      startsAt: '2026-03-28T22:00:00.000Z',
      endsAt: '2026-03-29T05:00:00.000Z',
      day: '2026-03-28',
      times: '22:00–06:00 (+1)',
    },
    {
      scenario: 'the clocks go back on the last Sunday of October',
      startsAt: '2026-10-24T21:00:00.000Z',
      endsAt: '2026-10-25T06:00:00.000Z',
      day: '2026-10-24',
      times: '22:00–06:00 (+1)',
    },
  ])('when an Overnight Shift spans the night $scenario', ({ startsAt, endsAt, day, times }) => {
    beforeEach(() => {
      shiftsIn = layOutShifts([shift('across', SAM, startsAt, endsAt)], LONDON);
    });

    it('shows local wall-clock times on the Saturday it starts', () => {
      expect(shiftsIn(SAM, day)).toEqual([
        { shift: expect.objectContaining({ id: 'across' }), times },
      ]);
    });
  });

  describe('when a Staff Member has two Shifts on one day, given latest first', () => {
    beforeEach(() => {
      shiftsIn = layOutShifts(
        [
          shift('evening', SAM, '2026-11-16T18:00:00.000Z', '2026-11-16T23:00:00.000Z'),
          shift('morning', SAM, '2026-11-16T07:00:00.000Z', '2026-11-16T11:00:00.000Z'),
        ],
        LONDON,
      );
    });

    it('lists them earliest first', () => {
      expect(shiftsIn(SAM, '2026-11-16').map(({ shift }) => shift.id)).toEqual([
        'morning',
        'evening',
      ]);
    });
  });
});
