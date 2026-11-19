import { formatShiftTimes, localDateOf, type Shift } from '@rota-ready/shared';

export interface ShiftInCell {
  id: string;
  times: string;
}

export function layOutShifts(shifts: Shift[], timeZone: string) {
  const cells = new Map<string, ShiftInCell[]>();
  const byStart = shifts.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const shift of byStart) {
    const startsAt = new Date(shift.startsAt);
    const key = cellKey(shift.staffMemberId, localDateOf(startsAt, timeZone));
    const times = formatShiftTimes(startsAt, new Date(shift.endsAt), { timeZone });
    cells.set(key, [...(cells.get(key) ?? []), { id: shift.id, times }]);
  }
  return (staffMemberId: string, day: string): ShiftInCell[] =>
    cells.get(cellKey(staffMemberId, day)) ?? [];
}

function cellKey(staffMemberId: string, day: string) {
  return `${staffMemberId}/${day}`;
}
