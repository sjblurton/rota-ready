import { firstNameOf, staffLinkPageSchema, staffLinkShiftSchema } from '@rota-ready/shared';
import { Router } from 'express';
import type { Clock } from './clock.js';
import type { Db } from './db.js';
import { sendError } from './http-errors.js';
import { toShift } from './rotas.js';
import { hashStaffLinkToken } from './staff-link-token.js';

const STAFF_LINK_PATH = /^\/api\/staff-links\/[^/?]+/;

export function withoutStaffLinkToken(url: string): string {
  return url.replace(STAFF_LINK_PATH, '/api/staff-links/[token]');
}

export function staffLinkRoutes(db: Db, clock: Clock): Router {
  const router = Router();

  router.get('/:token', async (req, res) => {
    const staffMember = await db.staffMember.findUnique({
      where: { staffLinkTokenHash: hashStaffLinkToken(req.params.token) },
      include: { venue: true },
    });
    if (!staffMember || staffMember.archivedAt) return sendError(res, 'not_found');
    const shifts = await db.shift.findMany({
      where: {
        staffMemberId: staffMember.id,
        rota: { status: 'published' },
        endsAt: { gt: clock.now() },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(
      staffLinkPageSchema.parse({
        firstName: firstNameOf(staffMember.name),
        venueName: staffMember.venue.name,
        timeZone: staffMember.venue.timeZone,
        shifts: shifts.map((shift) => staffLinkShiftSchema.parse(toShift(shift))),
      }),
    );
  });

  return router;
}
