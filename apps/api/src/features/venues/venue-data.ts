import type { CreateVenueRequest } from '@rota-ready/shared';
import { MemberRole } from '#src/generated/prisma/client.js';
import type { DbClient } from '#src/lib/db.js';

export function createVenueOwnedBy(db: DbClient, userId: string, details: CreateVenueRequest) {
  return db.venue.create({
    data: { ...details, members: { create: { userId, role: MemberRole.owner } } },
  });
}

export function findVenuesOfUser(db: DbClient, userId: string) {
  return db.venue.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'asc' },
  });
}

export function renameVenue(db: DbClient, venueId: string, name: string) {
  return db.venue.update({ where: { id: venueId }, data: { name } });
}

export function findVenueMembership(db: DbClient, userId: string, venueId: string) {
  return db.venueMember.findUnique({
    where: { userId_venueId: { userId, venueId } },
    include: { venue: true },
  });
}
