import { Router } from 'express';
import type { Logger } from 'pino';
import type { AuthConfig } from '#src/lib/auth.js';
import type { AnswerModel } from '#src/lib/answer-model.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import type { EmailSender } from '#src/lib/email-sender.js';
import { createAskService } from '#src/features/rota/ask-service.js';
import { rotaRouter } from '#src/features/rota/rota-router.js';
import { staffMemberRouter } from '#src/features/staff-members/staff-member-router.js';
import { withUser } from '#src/features/users/require-user.js';
import { requireVenueMember } from './require-venue-member.js';
import { venueController } from './venue-controller.js';
import { createVenueService } from './venue-service.js';

interface VenueRouterDependencies {
  db: Db;
  clock: Clock;
  authConfig: AuthConfig;
  staffLinkKey: Buffer;
  emailSender: EmailSender;
  webUrl: string;
  logger: Logger;
  answerModel: AnswerModel | null;
}

export function venueRouter(dependencies: VenueRouterDependencies): Router {
  const { db, clock, authConfig, staffLinkKey, answerModel } = dependencies;
  const asks = createAskService({ db, answerModel });
  const controller = venueController(createVenueService({ db }), asks.isAvailableFor);
  const router = Router();
  router.post('/', withUser(authConfig, db, controller.createVenue));
  router.get('/', withUser(authConfig, db, controller.listVenues));

  const venue = Router();
  venue.get('/', controller.getVenue);
  venue.patch('/', controller.renameVenue);
  venue.use('/staff-members', staffMemberRouter({ db, clock, staffLinkKey }));
  venue.use('/rotas', rotaRouter({ ...dependencies, asks }));

  router.use('/:venueId', requireVenueMember(authConfig, db), venue);
  return router;
}
