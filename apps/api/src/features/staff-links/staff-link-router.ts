import { Router } from 'express';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { staffLinkController } from './staff-link-controller.js';
import { createStaffLinkService } from './staff-link-service.js';

export function staffLinkRouter({ db, clock }: { db: Db; clock: Clock }): Router {
  const controller = staffLinkController(createStaffLinkService({ db, clock }), clock);
  const router = Router();
  router.get('/:token', controller.getStaffLinkPage);
  router.put('/:token/shifts/:shiftId/response', controller.respondToShift);
  return router;
}
