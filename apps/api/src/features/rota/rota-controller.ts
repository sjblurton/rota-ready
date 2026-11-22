import { byStaffMemberName, publishResultSchema, rotaSchema } from '@rota-ready/shared';
import type { Clock } from '#src/lib/clock.js';
import { sendError } from '#src/lib/http-errors.js';
import type { VenueRequestHandler } from '#src/features/venues/require-venue-member.js';
import type { RotaService } from './rota-service.js';
import { toShift } from './shift-controller.js';

export type RotaRequestHandler = VenueRequestHandler<{ weekStart: string }>;

export function rotaController(rotas: RotaService, clock: Clock) {
  const getRota: RotaRequestHandler = async (req, res) => {
    const { weekStart } = req.params;
    const { rota, shifts } = await rotas.get(res.locals.venue.id, weekStart);
    const now = clock.now();
    res.json(
      rotaSchema.parse({
        weekStart,
        status: rota.status,
        shifts: shifts.map((shift) => toShift(shift, now)),
      }),
    );
  };

  const publishRota: RotaRequestHandler = async (req, res) => {
    const result = await rotas.publish(res.locals.venue, req.params.weekStart);
    if (!result.ok) return sendError(res, result.code);
    res.json(
      publishResultSchema.parse({
        emails: result.emails
          .map(({ staffMember: { id, name }, status }) => ({ staffMemberId: id, name, status }))
          .sort(byStaffMemberName),
      }),
    );
  };

  return { getRota, publishRota };
}
