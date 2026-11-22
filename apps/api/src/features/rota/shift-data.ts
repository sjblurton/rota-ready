import type { Prisma, Shift } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';
import { weekStartDate } from './rota-data.js';

interface ShiftInWeekKey {
  id: string;
  venueId: string;
  weekStart: string;
}

export type ShiftTimes = Pick<Shift, 'staffMemberId' | 'startsAt' | 'endsAt'>;

function inWeek({ id, venueId, weekStart }: ShiftInWeekKey) {
  return { id, venueId, rota: { weekStart: weekStartDate(weekStart) } };
}

export function findShiftsOfRota(db: DbClient, rotaId: string) {
  return db.shift.findMany({
    where: { rotaId },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findShiftInWeek(db: DbClient, key: ShiftInWeekKey) {
  return db.shift.findFirst({ where: inWeek(key) });
}

export async function hasOverlappingShift(
  db: DbClient,
  { staffMemberId, startsAt, endsAt }: ShiftTimes,
  exceptShiftId?: string,
) {
  const overlapping = await db.shift.findFirst({
    where: {
      staffMemberId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(exceptShiftId && { id: { not: exceptShiftId } }),
    },
  });
  return overlapping !== null;
}

export function createShift(db: DbClient, data: Prisma.ShiftUncheckedCreateInput) {
  return db.shift.create({ data });
}

export function updateShift(db: DbClient, id: string, data: Prisma.ShiftUncheckedUpdateInput) {
  return db.shift.update({ where: { id }, data });
}

export async function deleteShiftInWeek(db: DbClient, key: ShiftInWeekKey) {
  const { count } = await db.shift.deleteMany({ where: inWeek(key) });
  return count === 1;
}
