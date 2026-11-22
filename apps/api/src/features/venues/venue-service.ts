import type { CreateVenueRequest } from '@rota-ready/shared';
import type { Venue } from '#src/generated/prisma/client.js';
import { isPrismaError, type Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  createVenueOwnedBy,
  findVenueMembership,
  findVenuesOfUser,
  renameVenue,
} from './venue-data.js';

export function createVenueService({ db }: { db: Db }) {
  return {
    async create(
      userId: string,
      details: CreateVenueRequest,
    ): Promise<{ ok: true; venue: Venue } | Refused<'venue_already_exists'>> {
      try {
        return { ok: true, venue: await createVenueOwnedBy(db, userId, details) };
      } catch (error) {
        if (isPrismaError(error, 'P2002')) return refuse('venue_already_exists');
        throw error;
      }
    },

    listFor(userId: string) {
      return findVenuesOfUser(db, userId);
    },

    rename(venueId: string, name: string) {
      return renameVenue(db, venueId, name);
    },

    membershipOf(userId: string, venueId: string) {
      return findVenueMembership(db, userId, venueId);
    },
  };
}

export type VenueService = ReturnType<typeof createVenueService>;
