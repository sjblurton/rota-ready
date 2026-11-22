import {
  createVenueRequestSchema,
  renameVenueRequestSchema,
  venueSchema,
} from '@rota-ready/shared';
import type { Request, Response } from 'express';
import type { User, Venue } from '../../generated/prisma/client.js';
import { parseBody, sendError } from '../../lib/http-errors.js';
import type { VenueRequestHandler } from './require-venue-member.js';
import type { VenueService } from './venue-service.js';

function toVenue({ id, name, timeZone }: Venue) {
  return venueSchema.parse({ id, name, timeZone });
}

export function venueController(venues: VenueService) {
  async function createVenue(req: Request, res: Response, user: User) {
    const body = parseBody(createVenueRequestSchema, req.body, res);
    if (!body) return;
    const result = await venues.create(user.id, body);
    if (!result.ok) return sendError(res, result.code);
    res.status(201).json(toVenue(result.venue));
  }

  async function listVenues(_req: Request, res: Response, user: User) {
    const list = await venues.listFor(user.id);
    res.json(list.map(toVenue));
  }

  const getVenue: VenueRequestHandler = (_req, res) => {
    res.json(toVenue(res.locals.venue));
  };

  const renameVenue: VenueRequestHandler = async (req, res) => {
    const body = parseBody(renameVenueRequestSchema, req.body, res);
    if (!body) return;
    res.json(toVenue(await venues.rename(res.locals.venue.id, body.name)));
  };

  return { createVenue, listVenues, getVenue, renameVenue };
}
