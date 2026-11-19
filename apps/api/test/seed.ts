import { randomUUID } from 'node:crypto';
import type { StaffMemberDetails } from '@rota-ready/shared';
import type { Db } from '../src/db.js';

export function createUser(
  db: Db,
  { id = randomUUID(), email = `${id}@example.com` }: { id?: string; email?: string } = {},
) {
  return db.user.create({ data: { id, email } });
}

export function createVenueFor(
  db: Db,
  user: { id: string },
  { name = 'The Crown', timeZone = 'Europe/London' } = {},
) {
  return db.venue.create({
    data: {
      name,
      timeZone,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
}

export function createStaffMember(
  db: Db,
  venue: { id: string },
  details: StaffMemberDetails,
  { archivedAt = null }: { archivedAt?: Date | null } = {},
) {
  return db.staffMember.create({ data: { ...details, venueId: venue.id, archivedAt } });
}
