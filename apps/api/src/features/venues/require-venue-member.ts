import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import type { Venue } from '../../generated/prisma/client.js';
import type { AuthConfig } from '../../lib/auth.js';
import type { Db } from '../../lib/db.js';
import { sendError } from '../../lib/http-errors.js';
import { authenticatedUser } from '../users/require-user.js';
import { createVenueService } from './venue-service.js';

export interface VenueMemberLocals {
  venue: Venue;
}

export type VenueRequestHandler<Params = { venueId: string }> = RequestHandler<
  Params,
  unknown,
  unknown,
  Request['query'],
  VenueMemberLocals
>;

const venueIdSchema = z.uuid();

export function requireVenueMember(config: AuthConfig, db: Db): VenueRequestHandler {
  const venues = createVenueService({ db });
  return async (req, res, next) => {
    const user = await authenticatedUser(req, res, config, db);
    if (!user) return;
    const venueId = venueIdSchema.safeParse(req.params.venueId);
    const membership = venueId.success
      ? await venues.membershipOf(user.id, venueId.data)
      : null;
    if (!membership) return sendError(res, 'not_found');
    res.locals.venue = membership.venue;
    next();
  };
}
