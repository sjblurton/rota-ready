import { apiErrorCode, type ShiftResponseRequest } from '@rota-ready/shared';
import { ShiftResponse, type Shift } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  answerPublishedShiftStartingAfter,
  clearPreviousTimesShownTo,
  findPublishedShiftsEndingAfter,
  findRemovedShiftsStartingAfter,
  findSentRemovalsStartingAfter,
  findShift,
  findStaffMemberByTokenHash,
  publishedShiftExists,
} from './staff-link-data.js';
import { toldTimesOf } from '#src/features/rota/shift-service.js';
import { hashStaffLinkToken } from './staff-link-token.js';

interface RemovedShiftTimes {
  startsAt: Date;
  endsAt: Date;
}

type LinkedStaffMember = NonNullable<Awaited<ReturnType<typeof findStaffMemberByTokenHash>>>;

export function createStaffLinkService({ db, clock }: { db: Db; clock: Clock }) {
  return {
    async staffMemberFor(
      token: string,
    ): Promise<{ ok: true; staffMember: LinkedStaffMember } | Refused<'not_found'>> {
      const staffMember = await findStaffMemberByTokenHash(db, hashStaffLinkToken(token));
      if (!staffMember || staffMember.archivedAt) return refuse(apiErrorCode.not_found);
      return { ok: true, staffMember };
    },

    upcomingShifts(staffMember: LinkedStaffMember) {
      return findPublishedShiftsEndingAfter(db, staffMember.id, clock.now());
    },

    async removedShifts(staffMember: LinkedStaffMember) {
      const now = clock.now();
      const [unsent, sent] = await Promise.all([
        findRemovedShiftsStartingAfter(db, staffMember.id, now),
        findSentRemovalsStartingAfter(db, staffMember.id, now),
      ]);
      const removed = new Map<string, RemovedShiftTimes>();
      for (const { shiftId, startsAt, endsAt } of sent) removed.set(shiftId, { startsAt, endsAt });
      for (const shift of unsent) {
        const told = toldTimesOf(shift);
        if (told) removed.set(shift.id, { startsAt: told.startsAt, endsAt: told.endsAt });
      }
      return [...removed]
        .map(([id, times]) => ({ id, ...times }))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    },

    async respond(
      staffMember: LinkedStaffMember,
      shiftId: string,
      request: ShiftResponseRequest,
    ): Promise<{ ok: true; shift: Shift } | Refused<'not_found' | 'shift_started'>> {
      const now = clock.now();
      const answered = await db.$transaction(async (tx) => {
        const updated = await answerPublishedShiftStartingAfter(
          tx,
          { staffMemberId: staffMember.id, shiftId, instant: now },
          {
            response: request.response,
            declineReason:
              request.response === ShiftResponse.declined ? request.declineReason : null,
            respondedAt: now,
          },
        );
        if (updated) await clearPreviousTimesShownTo(tx, staffMember.id, shiftId);
        return updated;
      });
      if (!answered) {
        const exists = await publishedShiftExists(db, staffMember.id, shiftId);
        return refuse(exists ? apiErrorCode.shift_started : apiErrorCode.not_found);
      }
      return { ok: true, shift: await findShift(db, shiftId) };
    },
  };
}

export type StaffLinkService = ReturnType<typeof createStaffLinkService>;
