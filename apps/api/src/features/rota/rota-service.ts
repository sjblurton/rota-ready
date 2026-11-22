import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import { findOrCreateRota, publishDraftRota } from './rota-data.js';
import { findShiftsOfRota } from './shift-data.js';

export function createRotaService({ db, clock }: { db: Db; clock: Clock }) {
  return {
    async get(venueId: string, weekStart: string) {
      const rota = await findOrCreateRota(db, venueId, weekStart);
      return { rota, shifts: await findShiftsOfRota(db, rota.id) };
    },

    async publish(
      venueId: string,
      weekStart: string,
    ): Promise<{ ok: true } | Refused<'rota_already_published'>> {
      const rota = await findOrCreateRota(db, venueId, weekStart);
      if (!(await publishDraftRota(db, rota.id, clock.now()))) {
        return refuse('rota_already_published');
      }
      return { ok: true };
    },
  };
}

export type RotaService = ReturnType<typeof createRotaService>;
