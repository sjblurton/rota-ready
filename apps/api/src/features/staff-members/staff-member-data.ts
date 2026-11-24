import type { Prisma } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';

export interface StaffMemberKey {
  id: string;
  venueId: string;
}

function active({ id, venueId }: StaffMemberKey) {
  return { id, venueId, archivedAt: null };
}

export function findActiveStaffMembers(db: DbClient, venueId: string) {
  return db.staffMember.findMany({ where: { venueId, archivedAt: null } });
}

export function countActiveStaffMembers(db: DbClient, venueId: string) {
  return db.staffMember.count({ where: { venueId, archivedAt: null } });
}

export function findActiveStaffMember(db: DbClient, key: StaffMemberKey) {
  return db.staffMember.findFirst({ where: active(key) });
}

export function findStaffMember(db: DbClient, id: string) {
  return db.staffMember.findUniqueOrThrow({ where: { id } });
}

export function createStaffMember(db: DbClient, data: Prisma.StaffMemberUncheckedCreateInput) {
  return db.staffMember.create({ data });
}

export function updateActiveStaffMember(
  db: DbClient,
  key: StaffMemberKey,
  data: Prisma.StaffMemberUpdateInput,
) {
  return db.staffMember.update({ where: active(key), data });
}

export async function setStaffLinkIfMissing(
  db: DbClient,
  id: string,
  columns: { staffLinkTokenHash: string; staffLinkTokenCiphertext: string },
) {
  const { count } = await db.staffMember.updateMany({
    where: { id, staffLinkTokenHash: null },
    data: columns,
  });
  return count === 1;
}

export async function hasShiftEndingAfter(db: DbClient, staffMemberId: string, instant: Date) {
  const shift = await db.shift.findFirst({ where: { staffMemberId, deletedAt: null, endsAt: { gt: instant } } });
  return shift !== null;
}

export async function lockActiveStaffMembersUntilCommit(
  tx: Prisma.TransactionClient,
  venueId: string,
  ids: string[],
) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM staff_members
    WHERE id = ANY(${ids}::uuid[]) AND venue_id = ${venueId}::uuid AND archived_at IS NULL
    ORDER BY id
    FOR UPDATE`;
  return new Set(rows.map(({ id }) => id));
}

export async function lockActiveStaffMemberUntilCommit(
  tx: Prisma.TransactionClient,
  { id, venueId }: StaffMemberKey,
) {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM staff_members
    WHERE id = ${id}::uuid AND venue_id = ${venueId}::uuid AND archived_at IS NULL
    FOR UPDATE`;
  return rows.length === 1;
}
