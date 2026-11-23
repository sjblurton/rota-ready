import {
  apiErrorCode,
  emailStatusSchema,
  firstNameOf,
  formatDate,
  formatEarlierShiftTimes,
  formatLocalDate,
  formatShiftTimes,
  type EmailStatus,
} from '@rota-ready/shared';
import type { Logger } from 'pino';
import { RotaStatus, type Shift, type StaffMember, type Venue } from '#src/generated/prisma/client.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import type { EmailSender } from '#src/lib/email-sender.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import { t } from '#src/i18n/i18n.js';
import { createStaffMemberService } from '#src/features/staff-members/staff-member-service.js';
import {
  findActiveStaffMembersOnRota,
  findOrCreateRota,
  findStaffMembers,
  lockRotaUntilCommit,
  markShiftsOfRotaTold,
  publishDraftRota,
} from './rota-data.js';
import {
  findLiveAndToldShiftsOfRota,
  findShiftsOfRota,
  findToldShiftsOfRota,
  moveToldSnapshotForward,
  type ShiftTimes,
} from './shift-data.js';
import { isChangedOrRemovedShift, isRemovedShift, toldTimesOf } from './shift-service.js';

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

interface Email {
  subject: string;
  text: string;
}

const shiftUpdateKind = { added: 'added', changed: 'changed', removed: 'removed' } as const;

type ShiftUpdate =
  | { kind: typeof shiftUpdateKind.added | typeof shiftUpdateKind.removed; staffMemberId: string; times: ShiftTimes }
  | { kind: typeof shiftUpdateKind.changed; staffMemberId: string; times: ShiftTimes; was: ShiftTimes };

function updatesOf(shift: Shift): ShiftUpdate[] {
  const told = toldTimesOf(shift);
  const { added, changed, removed } = shiftUpdateKind;
  if (shift.deletedAt !== null) {
    return told ? [{ kind: removed, staffMemberId: told.staffMemberId, times: told }] : [];
  }
  const { staffMemberId } = shift;
  if (!told) return [{ kind: added, staffMemberId, times: shift }];
  if (told.staffMemberId !== staffMemberId) {
    return [
      { kind: removed, staffMemberId: told.staffMemberId, times: told },
      { kind: added, staffMemberId, times: shift },
    ];
  }
  return [{ kind: changed, staffMemberId, times: shift, was: told }];
}

function describeUpdate(update: ShiftUpdate, timeZone: string) {
  const day = formatDate(update.times.startsAt, { timeZone });
  const times = formatShiftTimes(update.times.startsAt, update.times.endsAt, { timeZone });
  if (update.kind !== shiftUpdateKind.changed) {
    return t(`shiftUpdatesEmail.${update.kind}`, { day, times });
  }
  const was = formatEarlierShiftTimes(update.was, update.times.startsAt, { timeZone });
  return t('shiftUpdatesEmail.changed', { day, times, was });
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

  async function emailStaffLink(
    staffMember: StaffMember,
    compose: (staffLinkUrl: string) => Email,
  ): Promise<StaffLinkEmailResult> {
    if (!staffMember.email || staffMember.archivedAt) {
      return { staffMember, status: emailStatusSchema.enum.no_email };
    }
    try {
      const token = await staffMembers.staffLinkTokenOf(staffMember);
      const email = compose(new URL(`/s/${token}`, webUrl).href);
      await emailSender.send({ to: staffMember.email, ...email });
      return { staffMember, status: emailStatusSchema.enum.sent };
    } catch (error) {
      logger.warn({ err: error, staffMemberId: staffMember.id }, 'Staff Link email failed');
      return { staffMember, status: emailStatusSchema.enum.failed };
    }
  }

  function emailDetails(venue: Venue, weekStart: string, staffMember: StaffMember) {
    return {
      firstName: firstNameOf(staffMember.name),
      venueName: venue.name,
      week: formatLocalDate(weekStart, { withYear: true }),
    };
  }

  return {
    async get(venueId: string, weekStart: string) {
      const rota = await findOrCreateRota(db, venueId, weekStart);
      const [shifts, told] = await Promise.all([
        findShiftsOfRota(db, rota.id),
        findToldShiftsOfRota(db, rota.id),
      ]);
      return { rota, shifts, removedShifts: told.filter(isRemovedShift) };
    },

    async publish(
      venue: Venue,
      weekStart: string,
    ): Promise<{ ok: true; emails: StaffLinkEmailResult[] } | Refused<'rota_already_published'>> {
      const rota = await findOrCreateRota(db, venue.id, weekStart);
      const published = await db.$transaction(async (tx) => {
        if (!(await publishDraftRota(tx, rota.id, clock.now()))) return false;
        await markShiftsOfRotaTold(tx, rota.id);
        return true;
      });
      if (!published) return refuse(apiErrorCode.rota_already_published);
      const onRota = await findActiveStaffMembersOnRota(db, rota.id);
      const emails = await Promise.all(
        onRota.map((staffMember) =>
          emailStaffLink(staffMember, (staffLinkUrl) => {
            const details = { ...emailDetails(venue, weekStart, staffMember), staffLinkUrl };
            return {
              subject: t('staffLinkEmail.subject', details),
              text: t('staffLinkEmail.body', details),
            };
          }),
        ),
      );
      return { ok: true, emails };
    },

    async sendUpdates(
      venue: Venue,
      weekStart: string,
    ): Promise<{ ok: true; emails: StaffLinkEmailResult[] } | Refused<'rota_not_published'>> {
      const rota = await findOrCreateRota(db, venue.id, weekStart);
      if (rota.status !== RotaStatus.published) return refuse(apiErrorCode.rota_not_published);
      const unsent = await db.$transaction(async (tx) => {
        await lockRotaUntilCommit(tx, venue.id, weekStart);
        const shifts = (await findLiveAndToldShiftsOfRota(tx, rota.id)).filter((shift) =>
          isChangedOrRemovedShift(shift, rota.status),
        );
        for (const shift of shifts) await moveToldSnapshotForward(tx, shift);
        return shifts;
      });
      const updates = unsent.flatMap(updatesOf);
      const affected = await findStaffMembers(db, [
        ...new Set(updates.map(({ staffMemberId }) => staffMemberId)),
      ]);
      const emails = await Promise.all(
        affected.map((staffMember) =>
          emailStaffLink(staffMember, (staffLinkUrl) => {
            const changes = updates
              .filter(({ staffMemberId }) => staffMemberId === staffMember.id)
              .sort((a, b) => a.times.startsAt.getTime() - b.times.startsAt.getTime())
              .map((update) => describeUpdate(update, venue.timeZone))
              .join('\n');
            const details = { ...emailDetails(venue, weekStart, staffMember), staffLinkUrl, changes };
            return {
              subject: t('shiftUpdatesEmail.subject', details),
              text: t('shiftUpdatesEmail.body', details),
            };
          }),
        ),
      );
      return { ok: true, emails };
    },
  };
}

export type RotaService = ReturnType<typeof createRotaService>;
