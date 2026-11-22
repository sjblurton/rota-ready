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
  return { id, venueId, deletedAt: null, rota: { weekStart: weekStartDate(weekStart) } };
}

export function findShiftsOfRota(db: DbClient, rotaId: string) {
  return db.shift.findMany({
    where: { rotaId, deletedAt: null },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findToldShiftsOfRota(db: DbClient, rotaId: string) {
  return db.shift.findMany({
    where: { rotaId, toldStaffMemberId: { not: null } },
    orderBy: [{ toldStartsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findShiftInWeek(db: DbClient, key: ShiftInWeekKey) {
  return db.shift.findFirst({ where: inWeek(key), include: { rota: { select: { status: true } } } });
}

export async function hasOverlappingShift(
  db: DbClient,
  { staffMemberId, startsAt, endsAt }: ShiftTimes,
  exceptShiftId?: string,
) {
  const overlapping = await db.shift.findFirst({
    where: {
      staffMemberId,
      deletedAt: null,
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

export function updateLiveShift(
  db: DbClient,
  id: string,
  data: Prisma.ShiftUncheckedUpdateInput,
) {
  return db.shift.update({ where: { id, deletedAt: null }, data });
}

export function hardDeleteShift(db: DbClient, id: string) {
  return db.shift.delete({ where: { id } });
}

export function softDeleteShift(db: DbClient, id: string, deletedAt: Date) {
  return db.shift.update({ where: { id }, data: { deletedAt } });
}
