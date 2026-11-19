import { isWeekStart, rotaSchema } from '@rota-ready/shared';
import { Router } from 'express';
import type { VenueRequestHandler } from './auth.js';
import type { Db } from './db.js';
import { sendError } from './http-errors.js';

type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

function toDbDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

export function rotaRoutes(db: Db): Router {
  const router = Router();

  const getRota: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    if (!isWeekStart(weekStart)) return sendError(res, 'not_found');
    const key = { venueId: res.locals.venue.id, weekStart: toDbDate(weekStart) };
    const rota = await db.rota.upsert({
      where: { venueId_weekStart: key },
      create: key,
      update: {},
    });
    res.json(rotaSchema.parse({ weekStart, status: rota.status, shifts: [] }));
  };

  router.get('/:weekStart', getRota);

  return router;
}
