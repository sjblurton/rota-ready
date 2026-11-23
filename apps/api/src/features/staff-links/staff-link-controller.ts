import {
  apiErrorCode,
  firstNameOf,
  shiftResponseRequestSchema,
  removedShiftSchema,
  staffLinkPageSchema,
  staffLinkShiftSchema,
} from '@rota-ready/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Shift } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import { parseBody, sendError } from '#src/lib/http-errors.js';
import { shiftFields } from '#src/features/rota/shift-controller.js';
import type { ShiftTimes } from '#src/features/rota/shift-data.js';
import {
  isChangedPublishedShift,
  previousTimesShownWith,
} from '#src/features/rota/shift-service.js';
import type { StaffLinkService } from './staff-link-service.js';

const shiftIdSchema = z.uuid();

type Times = Omit<ShiftTimes, 'staffMemberId'>;

function toIsoTimes({ startsAt, endsAt }: Times) {
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function staffLinkController(staffLinks: StaffLinkService, clock: Clock) {
  function toStaffLinkShift(shift: Shift) {
    const previous = previousTimesShownWith(shift);
    return staffLinkShiftSchema.parse({
      ...shiftFields(shift, clock.now()),
      changed: isChangedPublishedShift(shift),
      previous: previous && toIsoTimes(previous),
    });
  }

  function toStaffLinkRemovedShift({ id, ...times }: Times & { id: string }) {
    return removedShiftSchema.parse({ id, ...toIsoTimes(times) });
  }

  return {
    async getStaffLinkPage(req: Request<{ token: string }>, res: Response) {
      const found = await staffLinks.staffMemberFor(req.params.token);
      if (!found.ok) return sendError(res, found.code);
      const { staffMember } = found;
      const [shifts, removedShifts] = await Promise.all([
        staffLinks.upcomingShifts(staffMember),
        staffLinks.removedShifts(staffMember),
      ]);
      res.json(
        staffLinkPageSchema.parse({
          firstName: firstNameOf(staffMember.name),
          venueName: staffMember.venue.name,
          timeZone: staffMember.venue.timeZone,
          shifts: shifts.map(toStaffLinkShift),
          removedShifts: removedShifts.map(toStaffLinkRemovedShift),
        }),
      );
    },

    async respondToShift(req: Request<{ token: string; shiftId: string }>, res: Response) {
      const found = await staffLinks.staffMemberFor(req.params.token);
      if (!found.ok) return sendError(res, found.code);
      const request = parseBody(shiftResponseRequestSchema, req.body, res);
      if (!request) return;
      const shiftId = shiftIdSchema.safeParse(req.params.shiftId);
      if (!shiftId.success) return sendError(res, apiErrorCode.not_found);
      const result = await staffLinks.respond(found.staffMember, shiftId.data, request);
      if (!result.ok) return sendError(res, result.code);
      res.json(toStaffLinkShift(result.shift));
    },
  };
}
