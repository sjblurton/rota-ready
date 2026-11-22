import { formatShiftTimes, localDateOf, type Shift } from '@rota-ready/shared';

type PlacedShift = Pick<Shift, 'staffMemberId' | 'startsAt' | 'endsAt'>;

export interface ShiftInCell<T extends PlacedShift = Shift> {
  shift: T;
  times: string;
}

export function layOutShifts<T extends PlacedShift>(shifts: T[], timeZone: string) {
  const cells = new Map<string, ShiftInCell<T>[]>();
  const byStart = shifts.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const shift of byStart) {
    const startsAt = new Date(shift.startsAt);
    const key = cellKey(shift.staffMemberId, localDateOf(startsAt, timeZone));
    const times = formatShiftTimes(startsAt, new Date(shift.endsAt), { timeZone });
    cells.set(key, [...(cells.get(key) ?? []), { shift, times }]);
  }
  return (staffMemberId: string, day: string): ShiftInCell<T>[] =>
    cells.get(cellKey(staffMemberId, day)) ?? [];
}

function cellKey(staffMemberId: string, day: string) {
  return `${staffMemberId}/${day}`;
}
