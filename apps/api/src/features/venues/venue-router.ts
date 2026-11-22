import { Router } from 'express';
import type { AuthConfig } from '../../lib/auth.js';
import type { Clock } from '../../lib/clock.js';
import type { Db } from '../../lib/db.js';
import { rotaRoutes } from '../../rotas.js';
import { staffMemberRouter } from '../staff-members/staff-member-router.js';
import { withUser } from '../users/require-user.js';
import { requireVenueMember } from './require-venue-member.js';
import { venueController } from './venue-controller.js';
import { createVenueService } from './venue-service.js';

interface VenueRouterDependencies {
  db: Db;
  clock: Clock;
  authConfig: AuthConfig;
  staffLinkKey: Buffer;
}

export function venueRouter({ db, clock, authConfig, staffLinkKey }: VenueRouterDependencies): Router {
  const controller = venueController(createVenueService({ db }));
  const router = Router();
  router.post('/', withUser(authConfig, db, controller.createVenue));
  router.get('/', withUser(authConfig, db, controller.listVenues));

  const venue = Router();
  venue.get('/', controller.getVenue);
  venue.patch('/', controller.renameVenue);
  venue.use('/staff-members', staffMemberRouter({ db, clock, staffLinkKey }));
  venue.use('/rotas', rotaRoutes(db, clock));

  router.use('/:venueId', requireVenueMember(authConfig, db), venue);
  return router;
}
