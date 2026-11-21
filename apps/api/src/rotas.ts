import {
  createShiftRequestSchema,
  isWeekStart,
  rotaSchema,
  shiftSchema,
  weekStartOf,
} from '@rota-ready/shared';
import { Router } from 'express';
import type { VenueRequestHandler } from './auth.js';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import type { Prisma, Shift, Venue } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';

type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

function toDbDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

export function toShift(
  { id, staffMemberId, startsAt, endsAt, response, declineReason }: Shift,
  now: Date,
) {
  return shiftSchema.parse({
    id,
    staffMemberId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    response,
    declineReason,
    started: startsAt <= now,
  });
}

async function lockStaffMemberUntilCommit(tx: Prisma.TransactionClient, staffMemberId: string) {
  await tx.$queryRaw`SELECT 1 FROM staff_members WHERE id = ${staffMemberId}::uuid FOR UPDATE`;
}

export function rotaRoutes(db: Db, clock: Clock): Router {
  const router = Router();

  async function findOrCreateRota(venue: Venue, weekStart: string) {
    const key = { venueId: venue.id, weekStart: toDbDate(weekStart) };
    await db.rota.createMany({ data: [key], skipDuplicates: true });
    return db.rota.findUniqueOrThrow({ where: { venueId_weekStart: key } });
  }

  const getRota: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const rota = await findOrCreateRota(res.locals.venue, weekStart);
    const shifts = await db.shift.findMany({
      where: { rotaId: rota.id },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    const now = clock.now();
    res.json(
      rotaSchema.parse({
        weekStart,
        status: rota.status,
        shifts: shifts.map((shift) => toShift(shift, now)),
      }),
    );
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
    const endsAt = new Date(request.endsAt);
    const rota = await findOrCreateRota(venue, weekStart);
    const shift = await db.$transaction(async (tx) => {
      await lockStaffMemberUntilCommit(tx, staffMember.id);
      const overlapping = await tx.shift.findFirst({
        where: {
          staffMemberId: staffMember.id,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlapping) return null;
      return tx.shift.create({
        data: {
          venueId: venue.id,
          rotaId: rota.id,
          staffMemberId: staffMember.id,
          startsAt,
          endsAt,
        },
      });
    });
    if (!shift) return sendError(res, 'shift_overlaps');
    res.status(201).json(toShift(shift, clock.now()));
  };

  const publishRota: RotaRequestHandler = async (req, res) => {
    const rota = await findOrCreateRota(res.locals.venue, req.params.weekStart);
    const { count } = await db.rota.updateMany({
      where: { id: rota.id, status: 'draft' },
      data: { status: 'published', publishedAt: clock.now() },
    });
    if (count === 0) return sendError(res, 'rota_already_published');
    res.status(204).end();
  };

  router.param('weekStart', (_req, res, next, weekStart: string) => {
    if (!isWeekStart(weekStart)) return sendError(res, 'not_found');
    next();
  });
  router.get('/:weekStart', getRota);
  router.post('/:weekStart/shifts', addShift);
  router.post('/:weekStart/publish', publishRota);

  return router;
}
