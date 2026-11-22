import { apiErrorCode, weekStartOf, type ShiftRequest } from '@rota-ready/shared';
import { ShiftResponse, type Prisma, type Shift, type Venue } from '#src/generated/prisma/client.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  findActiveStaffMember,
  lockActiveStaffMemberUntilCommit,
} from '#src/features/staff-members/staff-member-data.js';
import { findOrCreateRota } from './rota-data.js';
import {
  createShift,
  deleteShiftInWeek,
  findShiftInWeek,
  hasOverlappingShift,
  updateShift,
  type ShiftTimes,
} from './shift-data.js';

type ShiftResult = { ok: true; shift: Shift } | Refused<'not_found' | 'invalid_request' | 'shift_overlaps'>;

function detailsChanged(before: ShiftTimes, after: ShiftTimes) {
  return (
    before.staffMemberId !== after.staffMemberId ||
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime()
  );
}

export function createShiftService({ db }: { db: Db }) {
  async function resolveTimes(
    venue: Venue,
    weekStart: string,
    request: ShiftRequest,
  ): Promise<{ ok: true; times: ShiftTimes } | Refused<'not_found' | 'invalid_request'>> {
    const startsAt = new Date(request.startsAt);
    if (weekStartOf(startsAt, venue.timeZone) !== weekStart) return refuse(apiErrorCode.invalid_request);
    const staffMember = await findActiveStaffMember(db, {
      id: request.staffMemberId,
      venueId: venue.id,
    });
    if (!staffMember) return refuse(apiErrorCode.not_found);
    return {
      ok: true,
      times: { staffMemberId: staffMember.id, startsAt, endsAt: new Date(request.endsAt) },
    };
  }

  async function lockAndCheckOverlap(
    tx: Prisma.TransactionClient,
    venueId: string,
    times: ShiftTimes,
    exceptShiftId?: string,
  ) {
    if (!(await lockActiveStaffMemberUntilCommit(tx, { id: times.staffMemberId, venueId }))) {
      return refuse(apiErrorCode.not_found);
    }
    if (await hasOverlappingShift(tx, times, exceptShiftId)) return refuse(apiErrorCode.shift_overlaps);
    return null;
  }

  return {
    async add(venue: Venue, weekStart: string, request: ShiftRequest): Promise<ShiftResult> {
      const resolved = await resolveTimes(venue, weekStart, request);
      if (!resolved.ok) return resolved;
      const { times } = resolved;
      const rota = await findOrCreateRota(db, venue.id, weekStart);
      return db.$transaction(
        async (tx) =>
          (await lockAndCheckOverlap(tx, venue.id, times)) ?? {
            ok: true,
            shift: await createShift(tx, {
              ...times,
              role: request.role,
              notes: request.notes,
              venueId: venue.id,
              rotaId: rota.id,
            }),
          },
      );
    },

    async edit(
      venue: Venue,
      weekStart: string,
      shiftId: string,
      request: ShiftRequest,
    ): Promise<ShiftResult> {
      const existing = await findShiftInWeek(db, { id: shiftId, venueId: venue.id, weekStart });
      if (!existing) return refuse(apiErrorCode.not_found);
      const resolved = await resolveTimes(venue, weekStart, request);
      if (!resolved.ok) return resolved;
      const { times } = resolved;
      const details = { ...times, role: request.role, notes: request.notes };
      const data = detailsChanged(existing, times)
        ? { ...details, response: ShiftResponse.pending, declineReason: null, respondedAt: null }
        : details;
      return db.$transaction(
        async (tx) =>
          (await lockAndCheckOverlap(tx, venue.id, times, existing.id)) ?? {
            ok: true,
            shift: await updateShift(tx, existing.id, data),
          },
      );
    },

    async delete(
      venueId: string,
      weekStart: string,
      shiftId: string,
    ): Promise<{ ok: true } | Refused<'not_found'>> {
      const deleted = await deleteShiftInWeek(db, { id: shiftId, venueId, weekStart });
      return deleted ? { ok: true } : refuse(apiErrorCode.not_found);
    },
  };
}

export type ShiftService = ReturnType<typeof createShiftService>;
