import { apiErrorCode } from '@rota-ready/shared';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import type { Venue } from '#src/generated/prisma/client.js';
import type { AuthConfig } from '#src/lib/auth.js';
import type { Db } from '#src/lib/db.js';
import { sendError } from '#src/lib/http-errors.js';
import { authenticatedUser } from '#src/features/users/require-user.js';
import { createVenueService } from './venue-service.js';

export interface VenueMemberLocals {
  venue: Venue;
  userId: string;
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
    if (!membership) return sendError(res, apiErrorCode.not_found);
    res.locals.venue = membership.venue;
    res.locals.userId = user.id;
    next();
  };
}
