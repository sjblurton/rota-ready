import { emailStatusSchema, firstNameOf, formatLocalDate, type EmailStatus } from '@rota-ready/shared';
import type { Logger } from 'pino';
import type { StaffMember, Venue } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import type { EmailSender } from '#src/lib/email-sender.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import { t } from '#src/i18n/i18n.js';
import { createStaffMemberService } from '#src/features/staff-members/staff-member-service.js';
import { findActiveStaffMembersOnRota, findOrCreateRota, publishDraftRota } from './rota-data.js';
import { findShiftsOfRota } from './shift-data.js';

export interface RotaServiceDependencies {
  db: Db;
  clock: Clock;
  staffLinkKey: Buffer;
  emailSender: EmailSender;
  webUrl: string;
  logger: Logger;
}

export interface StaffLinkEmailResult {
  staffMember: StaffMember;
  status: EmailStatus;
}

export function createRotaService({
  db,
  clock,
  staffLinkKey,
  emailSender,
  webUrl,
  logger,
}: RotaServiceDependencies) {
  const staffMembers = createStaffMemberService({ db, clock, staffLinkKey });

  async function sendStaffLink(
    venue: Venue,
    weekStart: string,
    staffMember: StaffMember,
  ): Promise<StaffLinkEmailResult> {
    const failed = { staffMember, status: emailStatusSchema.enum.failed };
    if (!staffMember.email) return failed;
    try {
      const token = await staffMembers.staffLinkTokenOf(staffMember);
      const details = {
        firstName: firstNameOf(staffMember.name),
        venueName: venue.name,
        week: formatLocalDate(weekStart, { withYear: true }),
        staffLinkUrl: new URL(`/s/${token}`, webUrl).href,
      };
      await emailSender.send({
        to: staffMember.email,
        subject: t('staffLinkEmail.subject', details),
        text: t('staffLinkEmail.body', details),
      });
      return { staffMember, status: emailStatusSchema.enum.sent };
    } catch (error) {
      logger.warn({ err: error, staffMemberId: staffMember.id }, 'Staff Link email failed');
      return failed;
    }
  }

  return {
    async get(venueId: string, weekStart: string) {
      const rota = await findOrCreateRota(db, venueId, weekStart);
      return { rota, shifts: await findShiftsOfRota(db, rota.id) };
    },

    async publish(
      venue: Venue,
      weekStart: string,
    ): Promise<{ ok: true; emails: StaffLinkEmailResult[] } | Refused<'rota_already_published'>> {
      const rota = await findOrCreateRota(db, venue.id, weekStart);
      if (!(await publishDraftRota(db, rota.id, clock.now()))) {
        return refuse('rota_already_published');
      }
      const onRota = await findActiveStaffMembersOnRota(db, rota.id);
      const emails = await Promise.all(
        onRota.map((staffMember) => sendStaffLink(venue, weekStart, staffMember)),
      );
      return { ok: true, emails };
    },
  };
}

export type RotaService = ReturnType<typeof createRotaService>;
