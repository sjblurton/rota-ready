import { RotaStatus } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';

export function weekStartDate(weekStart: string): Date {
  return new Date(`${weekStart}T00:00:00Z`);
}

export async function findOrCreateRota(db: DbClient, venueId: string, weekStart: string) {
  const key = { venueId, weekStart: weekStartDate(weekStart) };
  await db.rota.createMany({ data: [key], skipDuplicates: true });
  return db.rota.findUniqueOrThrow({ where: { venueId_weekStart: key } });
}

export async function publishDraftRota(db: DbClient, rotaId: string, publishedAt: Date) {
  const { count } = await db.rota.updateMany({
    where: { id: rotaId, status: RotaStatus.draft },
    data: { status: RotaStatus.published, publishedAt },
  });
  return count === 1;
}
