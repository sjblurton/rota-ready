import { shiftRequestSchema, shiftSchema } from '@rota-ready/shared';
import { z } from 'zod';
import type { Shift } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import { parseBody, sendError } from '#src/lib/http-errors.js';
import type { VenueRequestHandler } from '#src/features/venues/require-venue-member.js';
import type { RotaRequestHandler } from './rota-controller.js';
import type { ShiftService } from './shift-service.js';

type ShiftRequestHandler = VenueRequestHandler<{ weekStart: string; shiftId: string }>;

const shiftIdSchema = z.uuid();

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

export function shiftController(shifts: ShiftService, clock: Clock) {
  const addShift: RotaRequestHandler = async (req, res) => {
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const result = await shifts.add(res.locals.venue, req.params.weekStart, request);
    if (!result.ok) return sendError(res, result.code);
    res.status(201).json(toShift(result.shift, clock.now()));
  };

  const editShift: ShiftRequestHandler = async (req, res) => {
    const request = parseBody(shiftRequestSchema, req.body, res);
    if (!request) return;
    const id = shiftIdSchema.safeParse(req.params.shiftId);
    if (!id.success) return sendError(res, 'not_found');
    const result = await shifts.edit(res.locals.venue, req.params.weekStart, id.data, request);
    if (!result.ok) return sendError(res, result.code);
    res.json(toShift(result.shift, clock.now()));
  };

  const deleteShift: ShiftRequestHandler = async (req, res) => {
    const id = shiftIdSchema.safeParse(req.params.shiftId);
    if (!id.success) return sendError(res, 'not_found');
    const result = await shifts.delete(res.locals.venue.id, req.params.weekStart, id.data);
    if (!result.ok) return sendError(res, result.code);
    res.status(204).end();
  };

  return { addShift, editShift, deleteShift };
}
