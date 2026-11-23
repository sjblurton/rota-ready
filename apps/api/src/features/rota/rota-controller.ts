import {
  byStaffMemberName,
  rotaSchema,
  staffLinkEmailsResultSchema,
} from '@rota-ready/shared';
import type { Clock } from '#src/lib/clock.js';
import { sendError } from '#src/lib/http-errors.js';
import type { VenueRequestHandler } from '#src/features/venues/require-venue-member.js';
import type { RotaService, StaffLinkEmailResult } from './rota-service.js';
import { toRemovedShift, toShift } from './shift-controller.js';

export type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

function toEmailsResult(emails: StaffLinkEmailResult[]) {
  return staffLinkEmailsResultSchema.parse({
    emails: emails
      .map(({ staffMember: { id, name }, status }) => ({ staffMemberId: id, name, status }))
      .sort(byStaffMemberName),
  });
}

export function rotaController(rotas: RotaService, clock: Clock) {
  const getRota: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const { rota, shifts, removedShifts } = await rotas.get(res.locals.venue.id, weekStart);
    const now = clock.now();
    res.json(
      rotaSchema.parse({
        weekStart,
        status: rota.status,
        shifts: shifts.map((shift) => toShift(shift, rota.status, now)),
        removedShifts: removedShifts.map(toRemovedShift),
      }),
    );
  };

  const publishRota: RotaRequestHandler = async (req, res) => {
    const result = await rotas.publish(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(toEmailsResult(result.emails));
  };

  const sendUpdates: RotaRequestHandler = async (req, res) => {
    const result = await rotas.sendUpdates(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(toEmailsResult(result.emails));
  };

  return { getRota, publishRota, sendUpdates };
}
