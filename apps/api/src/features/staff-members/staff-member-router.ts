import { Router } from 'express';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { staffMemberController } from './staff-member-controller.js';
import { createStaffMemberService } from './staff-member-service.js';

interface StaffMemberRouterDependencies {
  db: Db;
  clock: Clock;
  staffLinkKey: Buffer;
}

export function staffMemberRouter(dependencies: StaffMemberRouterDependencies): Router {
  const controller = staffMemberController(createStaffMemberService(dependencies));
  const router = Router();
  router.get('/', controller.listStaffMembers);
  router.post('/', controller.addStaffMember);
  router.patch('/:staffMemberId', controller.editStaffMember);
  router.post('/:staffMemberId/archive', controller.archiveStaffMember);
  router.get('/:staffMemberId/staff-link', controller.getStaffLink);
  router.post('/:staffMemberId/staff-link/regenerate', controller.regenerateStaffLink);
  return router;
}
