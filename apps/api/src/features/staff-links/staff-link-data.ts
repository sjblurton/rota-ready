import { RotaStatus, type Prisma } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';

export function findStaffMemberByTokenHash(db: DbClient, staffLinkTokenHash: string) {
  return db.staffMember.findUnique({ where: { staffLinkTokenHash }, include: { venue: true } });
}

export function findPublishedShiftsEndingAfter(
  db: DbClient,
  staffMemberId: string,
  instant: Date,
) {
  return db.shift.findMany({
    where: {
      staffMemberId,
      deletedAt: null,
      rota: { status: RotaStatus.published },
      endsAt: { gt: instant },
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export function findRemovedShiftsStartingAfter(
  db: DbClient,
  staffMemberId: string,
  instant: Date,
) {
  return db.shift.findMany({
    where: {
      toldStaffMemberId: staffMemberId,
      toldStartsAt: { gt: instant },
      rota: { status: RotaStatus.published },
      OR: [{ deletedAt: { not: null } }, { staffMemberId: { not: staffMemberId } }],
    },
    orderBy: [{ toldStartsAt: 'asc' }, { createdAt: 'asc' }],
  });
}

function publishedShiftOf(staffMemberId: string, shiftId: string) {
  return { id: shiftId, staffMemberId, deletedAt: null, rota: { status: RotaStatus.published } };
}

export async function answerPublishedShiftStartingAfter(
  db: DbClient,
  { staffMemberId, shiftId, instant }: { staffMemberId: string; shiftId: string; instant: Date },
  data: Pick<Prisma.ShiftUpdateManyMutationInput, 'response' | 'declineReason' | 'respondedAt'>,
) {
  const { count } = await db.shift.updateMany({
    where: { ...publishedShiftOf(staffMemberId, shiftId), startsAt: { gt: instant } },
    data,
  });
  return count === 1;
}

export async function publishedShiftExists(db: DbClient, staffMemberId: string, shiftId: string) {
  return (await db.shift.count({ where: publishedShiftOf(staffMemberId, shiftId) })) > 0;
}

export function findShift(db: DbClient, id: string) {
  return db.shift.findUniqueOrThrow({ where: { id } });
}
