import type { Prisma } from './generated/prisma/client.js';

// Prisma Client can't take a row lock, so SELECT … FOR UPDATE is raw SQL.
export async function lockActiveStaffMemberUntilCommit(
  tx: Prisma.TransactionClient,
  { id, venueId }: { id: string; venueId: string },
) {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM staff_members
    WHERE id = ${id}::uuid AND venue_id = ${venueId}::uuid AND archived_at IS NULL
    FOR UPDATE`;
  return rows.length === 1;
}
