import {
  createVenueRequestSchema,
  renameVenueRequestSchema,
  venueSchema,
} from '@rota-ready/shared';
import { Router } from 'express';
import {
  requireVenueMember,
  withUser,
  type AuthConfig,
  type VenueRequestHandler,
} from './auth.js';
import type { Db } from './db.js';
import { Prisma, type Venue } from './generated/prisma/client.js';
import { parseBody, sendError } from './http-errors.js';
import { rotaRoutes } from './rotas.js';
import { staffMemberRoutes } from './staff-members.js';

function toVenue({ id, name, timeZone }: Venue) {
  return venueSchema.parse({ id, name, timeZone });
}

export function venueRoutes(db: Db, authConfig: AuthConfig, staffLinkKey: Buffer): Router {
  const router = Router();

  router.post(
    '/',
    withUser(authConfig, db, async (req, res, user) => {
      const body = parseBody(createVenueRequestSchema, req.body, res);
      if (!body) return;
      try {
        const venue = await db.venue.create({
          data: { ...body, members: { create: { userId: user.id, role: 'owner' } } },
        });
        res.status(201).json(toVenue(venue));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return sendError(res, 'venue_already_exists');
        }
        throw error;
      }
    }),
  );

  router.get(
    '/',
    withUser(authConfig, db, async (_req, res, user) => {
      const venues = await db.venue.findMany({
        where: { members: { some: { userId: user.id } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json(venues.map(toVenue));
    }),
  );

  const getVenue: VenueRequestHandler = (_req, res) => {
    res.json(toVenue(res.locals.venue));
  };

  const renameVenue: VenueRequestHandler = async (req, res) => {
    const body = parseBody(renameVenueRequestSchema, req.body, res);
    if (!body) return;
    const renamed = await db.venue.update({
      where: { id: res.locals.venue.id },
      data: { name: body.name },
    });
    res.json(toVenue(renamed));
  };

  const venue = Router();
  venue.get('/', getVenue);
  venue.patch('/', renameVenue);
  venue.use('/staff-members', staffMemberRoutes(db, staffLinkKey));
  venue.use('/rotas', rotaRoutes(db));

  router.use('/:venueId', requireVenueMember(authConfig, db), venue);

  return router;
}
