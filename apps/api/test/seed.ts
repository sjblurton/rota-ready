import { randomUUID } from 'node:crypto';
import type { StaffMemberDetails } from '@rota-ready/shared';
import { Plan } from '#src/generated/prisma/client.js';
import type { Db } from '#src/lib/db.js';

export function createUser(
  db: Db,
  { id = randomUUID(), email = `${id}@example.com` }: { id?: string; email?: string } = {},
) {
  return db.user.create({ data: { id, email } });
}

export function createVenueFor(
  db: Db,
  user: { id: string },
  {
    name = 'The Crown',
    timeZone = 'Europe/London',
    plan = Plan.free,
  }: { name?: string; timeZone?: string; plan?: Plan } = {},
) {
  return db.venue.create({
    data: {
      name,
      timeZone,
      plan,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
}

export function moveVenueToPro(db: Db, venue: { id: string }) {
  return db.venue.update({ where: { id: venue.id }, data: { plan: Plan.pro } });
}

export function moveVenueToPreview(db: Db, venue: { id: string }) {
  return db.venue.update({ where: { id: venue.id }, data: { plan: Plan.preview } });
}

export function createActiveStaffMember(
  db: Db,
  venue: { id: string },
  details: StaffMemberDetails,
) {
  return db.staffMember.create({ data: { ...details, venueId: venue.id } });
}

export function createArchivedStaffMember(
  db: Db,
  venue: { id: string },
  details: Omit<StaffMemberDetails, 'email'>,
) {
  return db.staffMember.create({
    data: { ...details, email: null, venueId: venue.id, archivedAt: new Date('2026-01-01T00:00:00.000Z') },
  });
}

export function createRotaFor(db: Db, venue: { id: string }, weekStart: string) {
  return db.rota.create({
    data: { venueId: venue.id, weekStart: new Date(`${weekStart}T00:00:00Z`) },
  });
}

export function createShift(
  db: Db,
  rota: { id: string; venueId: string },
  staffMember: { id: string },
  { startsAt, endsAt }: { startsAt: string; endsAt: string },
) {
  return db.shift.create({
    data: {
      venueId: rota.venueId,
      rotaId: rota.id,
      staffMemberId: staffMember.id,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    },
  });
}

export function createPublishedRotaFor(db: Db, venue: { id: string }, weekStart: string) {
  return db.rota.create({
    data: {
      venueId: venue.id,
      weekStart: new Date(`${weekStart}T00:00:00Z`),
      status: 'published',
      publishedAt: new Date(`${weekStart}T00:00:00Z`),
    },
  });
}
