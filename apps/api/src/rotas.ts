import {
  isWeekStart,
  rotaSchema,
  shiftRequestSchema,
  shiftSchema,
  weekStartOf,
  type ShiftRequest,
} from '@rota-ready/shared';
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { VenueMemberLocals, VenueRequestHandler } from './auth.js';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import type { Prisma, Shift, Venue } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';

type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;
type ShiftRequestHandler = VenueRequestHandler<{ weekStart: string; shiftId: string }>;
type ShiftTimes = Pick<Shift, 'staffMemberId' | 'startsAt' | 'endsAt'>;

const shiftIdSchema = z.uuid();

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

function detailsChanged(before: ShiftTimes, after: ShiftTimes) {
  return (
    before.staffMemberId !== after.staffMemberId ||
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime()
  );
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

  async function resolveShiftTimesOrReject(
    res: Response<unknown, VenueMemberLocals>,
    weekStart: string,
    request: ShiftRequest,
  ) {
    const { venue } = res.locals;
    const startsAt = new Date(request.startsAt);
    if (weekStartOf(startsAt, venue.timeZone) !== weekStart) {
      sendError(res, 'invalid_request');
      return undefined;
    }
    const staffMember = await db.staffMember.findFirst({
      where: { id: request.staffMemberId, venueId: venue.id, archivedAt: null },
    });
    if (!staffMember) {
      sendError(res, 'not_found');
      return undefined;
    }
    return { staffMemberId: staffMember.id, startsAt, endsAt: new Date(request.endsAt) };
  }

  async function overlapsOtherShift(
    tx: Prisma.TransactionClient,
    { staffMemberId, startsAt, endsAt }: ShiftTimes,
    exceptShiftId?: string,
  ) {
    await lockStaffMemberUntilCommit(tx, staffMemberId);
    const overlapping = await tx.shift.findFirst({
      where: {
        staffMemberId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(exceptShiftId && { id: { not: exceptShiftId } }),
      },
    });
    return overlapping !== null;
  }

  const addShift: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const times = await resolveShiftTimesOrReject(res, weekStart, request);
    if (!times) return;
    const rota = await findOrCreateRota(res.locals.venue, weekStart);
    const shift = await db.$transaction(async (tx) => {
      if (await overlapsOtherShift(tx, times)) return null;
      return tx.shift.create({ data: { ...times, venueId: rota.venueId, rotaId: rota.id } });
    });
    if (!shift) return sendError(res, 'shift_overlaps');
    res.status(201).json(toShift(shift, clock.now()));
  };

  const editShift: ShiftRequestHandler = async (req, res) => {
    const { weekStart, shiftId } = req.params;
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const id = shiftIdSchema.safeParse(shiftId);
    const existing =
      id.success &&
      (await db.shift.findFirst({
        where: {
          id: id.data,
          venueId: res.locals.venue.id,
          rota: { weekStart: toDbDate(weekStart) },
        },
      }));
    if (!existing) return sendError(res, 'not_found');
    const times = await resolveShiftTimesOrReject(res, weekStart, request);
    if (!times) return;
    const data = detailsChanged(existing, times)
      ? { ...times, response: 'pending' as const, declineReason: null, respondedAt: null }
      : times;
    const shift = await db.$transaction(async (tx) => {
      if (await overlapsOtherShift(tx, times, existing.id)) return null;
      return tx.shift.update({ where: { id: existing.id }, data });
    });
    if (!shift) return sendError(res, 'shift_overlaps');
    res.json(toShift(shift, clock.now()));
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
  router.patch('/:weekStart/shifts/:shiftId', editShift);
  router.post('/:weekStart/publish', publishRota);

  return router;
}
