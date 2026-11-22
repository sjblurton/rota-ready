import type { ShiftResponseRequest } from '@rota-ready/shared';
import { ShiftResponse, type Shift } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  answerPublishedShiftStartingAfter,
  findPublishedShiftsEndingAfter,
  findShift,
  findStaffMemberByTokenHash,
  publishedShiftExists,
} from './staff-link-data.js';
import { hashStaffLinkToken } from './staff-link-token.js';

type LinkedStaffMember = NonNullable<Awaited<ReturnType<typeof findStaffMemberByTokenHash>>>;

export function createStaffLinkService({ db, clock }: { db: Db; clock: Clock }) {
  return {
    async staffMemberFor(
      token: string,
    ): Promise<{ ok: true; staffMember: LinkedStaffMember } | Refused<'not_found'>> {
      const staffMember = await findStaffMemberByTokenHash(db, hashStaffLinkToken(token));
      if (!staffMember || staffMember.archivedAt) return refuse('not_found');
      return { ok: true, staffMember };
    },

    upcomingShifts(staffMember: LinkedStaffMember) {
      return findPublishedShiftsEndingAfter(db, staffMember.id, clock.now());
    },

    async respond(
      staffMember: LinkedStaffMember,
      shiftId: string,
      request: ShiftResponseRequest,
    ): Promise<{ ok: true; shift: Shift } | Refused<'not_found' | 'shift_started'>> {
      const now = clock.now();
      const answered = await answerPublishedShiftStartingAfter(
        db,
        { staffMemberId: staffMember.id, shiftId, instant: now },
        {
          response: request.response,
          declineReason:
            request.response === ShiftResponse.declined ? request.declineReason : null,
          respondedAt: now,
        },
      );
      if (!answered) {
        const exists = await publishedShiftExists(db, staffMember.id, shiftId);
        return refuse(exists ? 'shift_started' : 'not_found');
      }
      return { ok: true, shift: await findShift(db, shiftId) };
    },
  };
}

export type StaffLinkService = ReturnType<typeof createStaffLinkService>;
