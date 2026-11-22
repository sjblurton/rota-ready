import type { StaffMemberDetails } from '@rota-ready/shared';
import type { Prisma, StaffMember } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import { isPrismaError, type Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import {
  decryptStaffLinkToken,
  encryptStaffLinkToken,
  generateStaffLinkToken,
  hashStaffLinkToken,
} from '#src/features/staff-links/staff-link-token.js';
import {
  createStaffMember,
  findActiveStaffMember,
  findActiveStaffMembers,
  findStaffMember,
  hasShiftEndingAfter,
  lockActiveStaffMemberUntilCommit,
  setStaffLinkIfMissing,
  updateActiveStaffMember,
  type StaffMemberKey,
} from './staff-member-data.js';

interface StaffMemberServiceDependencies {
  db: Db;
  clock: Clock;
  staffLinkKey: Buffer;
}

type StaffMemberResult<Code extends 'not_found' | 'staff_member_email_taken'> =
  | { ok: true; staffMember: StaffMember }
  | Refused<Code>;

export function createStaffMemberService({ db, clock, staffLinkKey }: StaffMemberServiceDependencies) {
  function newStaffLinkColumns() {
    const token = generateStaffLinkToken();
    return {
      token,
      columns: {
        staffLinkTokenHash: hashStaffLinkToken(token),
        staffLinkTokenCiphertext: encryptStaffLinkToken(token, staffLinkKey),
      },
    };
  }

  async function update(
    key: StaffMemberKey,
    data: Prisma.StaffMemberUpdateInput,
  ): Promise<StaffMemberResult<'not_found' | 'staff_member_email_taken'>> {
    try {
      return { ok: true, staffMember: await updateActiveStaffMember(db, key, data) };
    } catch (error) {
      if (isPrismaError(error, 'P2025')) return refuse('not_found');
      if (isPrismaError(error, 'P2002')) return refuse('staff_member_email_taken');
      throw error;
    }
  }

  async function staffLinkTokenOf(staffMember: StaffMember): Promise<string> {
    if (staffMember.staffLinkTokenCiphertext) {
      return decryptStaffLinkToken(staffMember.staffLinkTokenCiphertext, staffLinkKey);
    }
    const { token, columns } = newStaffLinkColumns();
    if (await setStaffLinkIfMissing(db, staffMember.id, columns)) return token;
    return staffLinkTokenOf(await findStaffMember(db, staffMember.id));
  }

  return {
    staffLinkTokenOf,

    list(venueId: string) {
      return findActiveStaffMembers(db, venueId);
    },

    async add(
      venueId: string,
      details: StaffMemberDetails,
    ): Promise<StaffMemberResult<'staff_member_email_taken'>> {
      try {
        const staffMember = await createStaffMember(db, {
          ...details,
          ...newStaffLinkColumns().columns,
          venueId,
        });
        return { ok: true, staffMember };
      } catch (error) {
        if (isPrismaError(error, 'P2002')) return refuse('staff_member_email_taken');
        throw error;
      }
    },

    edit(key: StaffMemberKey, details: StaffMemberDetails) {
      return update(key, details);
    },

    async archive(
      key: StaffMemberKey,
    ): Promise<{ ok: true } | Refused<'not_found' | 'staff_member_has_upcoming_shifts'>> {
      const now = clock.now();
      return db.$transaction(async (tx) => {
        if (!(await lockActiveStaffMemberUntilCommit(tx, key))) return refuse('not_found');
        if (await hasShiftEndingAfter(tx, key.id, now)) {
          return refuse('staff_member_has_upcoming_shifts');
        }
        await updateActiveStaffMember(tx, key, { archivedAt: now, email: null });
        return { ok: true };
      });
    },

    async staffLink(key: StaffMemberKey): Promise<{ ok: true; token: string } | Refused<'not_found'>> {
      const staffMember = await findActiveStaffMember(db, key);
      if (!staffMember) return refuse('not_found');
      return { ok: true, token: await staffLinkTokenOf(staffMember) };
    },

    async regenerateStaffLink(
      key: StaffMemberKey,
    ): Promise<{ ok: true; token: string } | Refused<'not_found' | 'staff_member_email_taken'>> {
      const { token, columns } = newStaffLinkColumns();
      const result = await update(key, columns);
      return result.ok ? { ok: true, token } : result;
    },
  };
}

export type StaffMemberService = ReturnType<typeof createStaffMemberService>;
