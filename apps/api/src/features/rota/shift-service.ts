import { apiErrorCode, weekStartOf, type ShiftRequest } from '@rota-ready/shared';
import {
  RotaStatus,
  ShiftResponse,
  type Prisma,
  type Shift,
  type Venue,
} from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import { isPrismaError, type Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  findActiveStaffMember,
  lockActiveStaffMemberUntilCommit,
} from '#src/features/staff-members/staff-member-data.js';
import { findOrCreateRota, lockRotaUntilCommit } from './rota-data.js';
import {
  createShift,
  hardDeleteShift,
  softDeleteShift,
  findShiftInWeek,
  hasOverlappingShift,
  updateLiveShift,
  type ShiftTimes,
} from './shift-data.js';

type ShiftResult =
  | { ok: true; shift: Shift; rotaStatus: RotaStatus }
  | Refused<'not_found' | 'invalid_request' | 'shift_overlaps'>;

function detailsChanged(before: ShiftTimes, after: ShiftTimes) {
  return (
    before.staffMemberId !== after.staffMemberId ||
    before.startsAt.getTime() !== after.startsAt.getTime() ||
    before.endsAt.getTime() !== after.endsAt.getTime()
  );
}

export function notifiedTimesOf({
  notifiedStaffMemberId,
  notifiedStartsAt,
  notifiedEndsAt,
}: Shift): ShiftTimes | null {
  if (notifiedStaffMemberId === null || notifiedStartsAt === null || notifiedEndsAt === null) {
    return null;
  }
  return { staffMemberId: notifiedStaffMemberId, startsAt: notifiedStartsAt, endsAt: notifiedEndsAt };
}

export function isChangedShift(shift: Shift, rotaStatus: RotaStatus) {
  if (rotaStatus !== RotaStatus.published) return false;
  const notified = notifiedTimesOf(shift);
  return notified === null || detailsChanged(notified, shift);
}

export function isRemovedShift(shift: Shift) {
  const notified = notifiedTimesOf(shift);
  return (
    notified !== null &&
    (shift.deletedAt !== null || notified.staffMemberId !== shift.staffMemberId)
  );
}

export function isChangedOrRemovedShift(shift: Shift, rotaStatus: RotaStatus) {
  return (shift.deletedAt === null && isChangedShift(shift, rotaStatus)) || isRemovedShift(shift);
}

export function isChangedPublishedShift(shift: Shift) {
  return isChangedShift(shift, RotaStatus.published);
}

export function previousTimesShownWith(shift: Shift) {
  const { staffMemberId, notifiedStaffMemberId, previousStaffMemberId, previousStartsAt, previousEndsAt } =
    shift;
  const notifiedSinceSent =
    notifiedStaffMemberId === staffMemberId && previousStaffMemberId === staffMemberId;
  if (!notifiedSinceSent || !previousStartsAt || !previousEndsAt) return null;
  if (isChangedPublishedShift(shift)) return null;
  return { startsAt: previousStartsAt, endsAt: previousEndsAt };
}

export function createShiftService({ db, clock }: { db: Db; clock: Clock }) {
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
            rotaStatus: rota.status,
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
      try {
        return await db.$transaction(
          async (tx) =>
            (await lockAndCheckOverlap(tx, venue.id, times, existing.id)) ?? {
              ok: true,
              rotaStatus: existing.rota.status,
              shift: await updateLiveShift(tx, existing.id, data),
            },
        );
      } catch (error) {
        if (isPrismaError(error, 'P2025')) return refuse(apiErrorCode.not_found);
        throw error;
      }
    },

    async delete(
      venueId: string,
      weekStart: string,
      shiftId: string,
    ): Promise<{ ok: true } | Refused<'not_found'>> {
      return db.$transaction(async (tx) => {
        await lockRotaUntilCommit(tx, venueId, weekStart);
        const shift = await findShiftInWeek(tx, { id: shiftId, venueId, weekStart });
        if (!shift) return refuse(apiErrorCode.not_found);
        if (notifiedTimesOf(shift)) await softDeleteShift(tx, shift.id, clock.now());
        else await hardDeleteShift(tx, shift.id);
        return { ok: true as const };
      });
    },
  };
}

export type ShiftService = ReturnType<typeof createShiftService>;
