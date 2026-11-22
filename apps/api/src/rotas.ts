import {
  isWeekStart,
  rotaSchema,
  shiftRequestSchema,
  shiftSchema,
  weekStartOf,
  type ApiErrorCode,
  type ShiftRequest,
} from '@rota-ready/shared';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { lockActiveStaffMemberUntilCommit } from '#src/features/staff-members/staff-member-data.js';
import type {
  VenueMemberLocals,
  VenueRequestHandler,
} from '#src/features/venues/require-venue-member.js';
import {
  RotaStatus,
  ShiftResponse,
  type Prisma,
  type Shift,
  type Venue,
} from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { parseBody, sendError } from '#src/lib/http-errors.js';

type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;
type ShiftRequestHandler = VenueRequestHandler<{ weekStart: string; shiftId: string }>;
type ShiftTimes = Pick<Shift, 'staffMemberId' | 'startsAt' | 'endsAt'>;

const shiftIdSchema = z.uuid();

function toDbDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

export function toShift(
  { id, staffMemberId, startsAt, endsAt, role, notes, response, declineReason }: Shift,
  now: Date,
) {
  return shiftSchema.parse({
    id,
    staffMemberId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    role,
    notes,
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

function shiftInWeekWhere(venueId: string, weekStart: string, shiftId: string) {
  const id = shiftIdSchema.safeParse(shiftId);
  return id.success
    ? { id: id.data, venueId, rota: { weekStart: toDbDate(weekStart) } }
    : null;
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

  async function shiftRejection(
    tx: Prisma.TransactionClient,
    venueId: string,
    { staffMemberId, startsAt, endsAt }: ShiftTimes,
    exceptShiftId?: string,
  ): Promise<ApiErrorCode | null> {
    if (!(await lockActiveStaffMemberUntilCommit(tx, { id: staffMemberId, venueId }))) {
      return 'not_found';
    }
    const overlapping = await tx.shift.findFirst({
      where: {
        staffMemberId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(exceptShiftId && { id: { not: exceptShiftId } }),
      },
    });
    return overlapping ? 'shift_overlaps' : null;
  }

  const addShift: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const times = await resolveShiftTimesOrReject(res, weekStart, request);
    if (!times) return;
    const rota = await findOrCreateRota(res.locals.venue, weekStart);
    const shift = await db.$transaction(
      async (tx) =>
        (await shiftRejection(tx, rota.venueId, times)) ??
        tx.shift.create({
          data: {
            ...times,
            role: request.role,
            notes: request.notes,
            venueId: rota.venueId,
            rotaId: rota.id,
          },
        }),
    );
    if (typeof shift === 'string') return sendError(res, shift);
    res.status(201).json(toShift(shift, clock.now()));
  };

  const editShift: ShiftRequestHandler = async (req, res) => {
    const { weekStart, shiftId } = req.params;
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const where = shiftInWeekWhere(res.locals.venue.id, weekStart, shiftId);
    const existing = where && (await db.shift.findFirst({ where }));
    if (!existing) return sendError(res, 'not_found');
    const times = await resolveShiftTimesOrReject(res, weekStart, request);
    if (!times) return;
    const details = { ...times, role: request.role, notes: request.notes };
    const data = detailsChanged(existing, times)
      ? { ...details, response: ShiftResponse.pending, declineReason: null, respondedAt: null }
      : details;
    const shift = await db.$transaction(
      async (tx) =>
        (await shiftRejection(tx, existing.venueId, times, existing.id)) ??
        tx.shift.update({ where: { id: existing.id }, data }),
    );
    if (typeof shift === 'string') return sendError(res, shift);
    res.json(toShift(shift, clock.now()));
  };

  const deleteShift: ShiftRequestHandler = async (req, res) => {
    const { weekStart, shiftId } = req.params;
    const where = shiftInWeekWhere(res.locals.venue.id, weekStart, shiftId);
    const { count } = where ? await db.shift.deleteMany({ where }) : { count: 0 };
    if (count === 0) return sendError(res, 'not_found');
    res.status(204).end();
  };

  const publishRota: RotaRequestHandler = async (req, res) => {
    const rota = await findOrCreateRota(res.locals.venue, req.params.weekStart);
    const { count } = await db.rota.updateMany({
      where: { id: rota.id, status: RotaStatus.draft },
      data: { status: RotaStatus.published, publishedAt: clock.now() },
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
  router.delete('/:weekStart/shifts/:shiftId', deleteShift);
  router.post('/:weekStart/publish', publishRota);

  return router;
}
