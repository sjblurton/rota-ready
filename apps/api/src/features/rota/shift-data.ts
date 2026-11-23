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

export function findNotifiedShiftsOfRota(db: DbClient, rotaId: string) {
  return db.shift.findMany({
    where: { rotaId, notifiedStaffMemberId: { not: null } },
    orderBy: [{ notifiedStartsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findLiveAndNotifiedShiftsOfRota(db: DbClient, rotaId: string) {
  return db.shift.findMany({
    where: { rotaId, OR: [{ deletedAt: null }, { notifiedStaffMemberId: { not: null } }] },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function moveNotifiedSnapshotForward(db: DbClient, shift: Shift) {
  const { notifiedStaffMemberId, notifiedStartsAt, notifiedEndsAt } = shift;
  const removedFromNotifiedStaffMember =
    shift.deletedAt !== null || notifiedStaffMemberId !== shift.staffMemberId;
  if (
    notifiedStaffMemberId &&
    notifiedStartsAt &&
    notifiedEndsAt &&
    removedFromNotifiedStaffMember
  ) {
    const removal = { startsAt: notifiedStartsAt, endsAt: notifiedEndsAt };
    await db.shiftRemoval.upsert({
      where: { shiftId_staffMemberId: { shiftId: shift.id, staffMemberId: notifiedStaffMemberId } },
      create: { shiftId: shift.id, staffMemberId: notifiedStaffMemberId, ...removal },
      update: removal,
    });
  }
  const notified =
    shift.deletedAt === null
      ? {
          notifiedStaffMemberId: shift.staffMemberId,
          notifiedStartsAt: shift.startsAt,
          notifiedEndsAt: shift.endsAt,
        }
      : { notifiedStaffMemberId: null, notifiedStartsAt: null, notifiedEndsAt: null };
  await db.shift.update({
    where: { id: shift.id },
    data: {
      previousStaffMemberId: notifiedStaffMemberId,
      previousStartsAt: notifiedStartsAt,
      previousEndsAt: notifiedEndsAt,
      ...notified,
    },
  });
}

export function findLiveShiftsOfActiveStaffInWeek(db: DbClient, venueId: string, weekStart: string) {
  return db.shift.findMany({
    where: {
      venueId,
      deletedAt: null,
      rota: { weekStart: weekStartDate(weekStart) },
      staffMember: { archivedAt: null },
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findLiveShiftsOfStaffBetween(
  db: DbClient,
  staffMemberIds: string[],
  from: Date,
  to: Date,
) {
  return db.shift.findMany({
    where: { staffMemberId: { in: staffMemberIds }, deletedAt: null, startsAt: { lt: to }, endsAt: { gt: from } },
  });
}

export function createShifts(db: DbClient, data: Prisma.ShiftCreateManyInput[]) {
  return db.shift.createMany({ data });
}

export async function hasLiveShifts(db: DbClient, rotaId: string) {
  return (await db.shift.count({ where: { rotaId, deletedAt: null } })) > 0;
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
