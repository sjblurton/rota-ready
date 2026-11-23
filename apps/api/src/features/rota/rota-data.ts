import { RotaStatus, type Prisma } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';

export function weekStartDate(weekStart: string): Date {
  return new Date(`${weekStart}T00:00:00Z`);
}

export async function findOrCreateRota(db: DbClient, venueId: string, weekStart: string) {
  const key = { venueId, weekStart: weekStartDate(weekStart) };
  await db.rota.createMany({ data: [key], skipDuplicates: true });
  return db.rota.findUniqueOrThrow({ where: { venueId_weekStart: key } });
}

export async function lockRotaUntilCommit(
  tx: Prisma.TransactionClient,
  venueId: string,
  weekStart: string,
) {
  await tx.$queryRaw`
    SELECT 1 FROM rotas
    WHERE venue_id = ${venueId}::uuid AND week_start = ${weekStart}::date
    FOR NO KEY UPDATE`;
}

export function findRota(db: DbClient, rotaId: string) {
  return db.rota.findUniqueOrThrow({ where: { id: rotaId } });
}

export async function publishDraftRota(db: DbClient, rotaId: string, publishedAt: Date) {
  const { count } = await db.rota.updateMany({
    where: { id: rotaId, status: RotaStatus.draft },
    data: { status: RotaStatus.published, publishedAt },
  });
  return count === 1;
}

export function findActiveStaffMembersOnRota(db: DbClient, rotaId: string) {
  return db.staffMember.findMany({
    where: { archivedAt: null, shifts: { some: { rotaId } } },
  });
}

export function findStaffMembers(db: DbClient, ids: string[]) {
  return db.staffMember.findMany({ where: { id: { in: ids } } });
}

export function markShiftsOfRotaTold(db: DbClient, rotaId: string) {
  return db.$executeRaw`
    UPDATE shifts
    SET told_staff_member_id = staff_member_id, told_starts_at = starts_at, told_ends_at = ends_at
    WHERE rota_id = ${rotaId}::uuid
  `;
}
