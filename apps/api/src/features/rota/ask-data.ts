import type { DbClient } from '#src/lib/db.js';
import { weekStartDate } from './rota-data.js';

export function findRotaToAskAbout(db: DbClient, venueId: string, weekStart: string) {
  return db.rota.findUnique({
    where: { venueId_weekStart: { venueId, weekStart: weekStartDate(weekStart) } },
    select: {
      status: true,
      shifts: {
        where: { deletedAt: null },
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          startsAt: true,
          endsAt: true,
          role: true,
          staffMember: { select: { name: true, role: true } },
        },
      },
    },
  });
}
