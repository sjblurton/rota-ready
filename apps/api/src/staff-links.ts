import {
  firstNameOf,
  shiftResponseRequestSchema,
  staffLinkPageSchema,
  staffLinkShiftSchema,
} from '@rota-ready/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import { RotaStatus, ShiftResponse, type Shift } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';
import { toShift } from './rotas.js';
import { hashStaffLinkToken } from './staff-link-token.js';

const STAFF_LINK_PATH = /^\/api\/staff-links\/[^/?]+/;

const shiftIdSchema = z.uuid();

export function withoutStaffLinkToken(url: string): string {
  return url.replace(STAFF_LINK_PATH, '/api/staff-links/[token]');
}

export function staffLinkRoutes(db: Db, clock: Clock): Router {
  const router = Router();

  async function findStaffMember(req: Request<{ token: string }>, res: Response) {
    const staffMember = await db.staffMember.findUnique({
      where: { staffLinkTokenHash: hashStaffLinkToken(req.params.token) },
      include: { venue: true },
    });
    if (!staffMember || staffMember.archivedAt) {
      sendError(res, 'not_found');
      return undefined;
    }
    return staffMember;
  }

  function toStaffLinkShift(shift: Shift) {
    return staffLinkShiftSchema.parse(toShift(shift, clock.now()));
  }

  router.get('/:token', async (req, res) => {
    const staffMember = await findStaffMember(req, res);
    if (!staffMember) return;
    const shifts = await db.shift.findMany({
      where: {
        staffMemberId: staffMember.id,
        rota: { status: RotaStatus.published },
        endsAt: { gt: clock.now() },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(
      staffLinkPageSchema.parse({
        firstName: firstNameOf(staffMember.name),
        venueName: staffMember.venue.name,
        timeZone: staffMember.venue.timeZone,
        shifts: shifts.map(toStaffLinkShift),
      }),
    );
  });

  router.put('/:token/shifts/:shiftId/response', async (req, res) => {
    const staffMember = await findStaffMember(req, res);
    if (!staffMember) return;
    const request = parseBody(shiftResponseRequestSchema, req.body, res);
    if (!request) return;
    const id = shiftIdSchema.safeParse(req.params.shiftId);
    if (!id.success) return sendError(res, 'not_found');
    const where = {
      id: id.data,
      staffMemberId: staffMember.id,
      rota: { status: RotaStatus.published },
    };
    const now = clock.now();
    const { count } = await db.shift.updateMany({
      where: { ...where, startsAt: { gt: now } },
      data: {
        response: request.response,
        declineReason: request.response === ShiftResponse.declined ? request.declineReason : null,
        respondedAt: now,
      },
    });
    if (count === 0) {
      const exists = (await db.shift.count({ where })) > 0;
      return sendError(res, exists ? 'shift_started' : 'not_found');
    }
    res.json(toStaffLinkShift(await db.shift.findUniqueOrThrow({ where: { id: where.id } })));
  });

  return router;
}
