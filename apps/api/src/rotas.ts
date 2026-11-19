import {
  createShiftRequestSchema,
  isWeekStart,
  rotaSchema,
  shiftSchema,
  weekStartOf,
} from '@rota-ready/shared';
import { Router } from 'express';
import type { VenueRequestHandler } from './auth.js';
import type { Db } from './db.js';
import type { Shift, Venue } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';

type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

function toDbDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

function toShift({ id, staffMemberId, startsAt, endsAt }: Shift) {
  return shiftSchema.parse({
    id,
    staffMemberId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });
}

export function rotaRoutes(db: Db): Router {
  const router = Router();

  function findOrCreateRota(venue: Venue, weekStart: string) {
    const key = { venueId: venue.id, weekStart: toDbDate(weekStart) };
    return db.rota.upsert({ where: { venueId_weekStart: key }, create: key, update: {} });
  }

  const getRota: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const rota = await findOrCreateRota(res.locals.venue, weekStart);
    const shifts = await db.shift.findMany({
      where: { rotaId: rota.id },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(rotaSchema.parse({ weekStart, status: rota.status, shifts: shifts.map(toShift) }));
  };

  const addShift: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const request = parseBody(createShiftRequestSchema, req.body, res);
    if (!request) return;
    const { venue } = res.locals;
    const startsAt = new Date(request.startsAt);
    if (weekStartOf(startsAt, venue.timeZone) !== weekStart) {
      return sendError(res, 'invalid_request');
    }
    const staffMember = await db.staffMember.findFirst({
      where: { id: request.staffMemberId, venueId: venue.id, archivedAt: null },
    });
    if (!staffMember) return sendError(res, 'not_found');
    const rota = await findOrCreateRota(venue, weekStart);
    const shift = await db.shift.create({
      data: {
        venueId: venue.id,
        rotaId: rota.id,
        staffMemberId: staffMember.id,
        startsAt,
        endsAt: new Date(request.endsAt),
      },
    });
    res.status(201).json(toShift(shift));
  };

  router.param('weekStart', (_req, res, next, weekStart: string) => {
    if (!isWeekStart(weekStart)) return sendError(res, 'not_found');
    next();
  });
  router.get('/:weekStart', getRota);
  router.post('/:weekStart/shifts', addShift);

  return router;
}
