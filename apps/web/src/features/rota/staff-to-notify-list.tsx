import {
  formatDate,
  formatPreviousShiftTimes,
  formatShiftTimes,
  shiftUpdateKind,
  type PublishResult,
  type SendUpdatesResult,
  type ShiftUpdate,
} from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useRotaWeek } from '@/features/rota/rota-queries';
import { useCopyStaffLink } from '@/features/staff-links/copy-staff-link';

type StaffMemberToNotify = PublishResult['staffMembers'][number] &
  Partial<Pick<SendUpdatesResult['staffMembers'][number], 'updates'>>;

interface StaffToNotifyListProps {
  venueId: string;
  weekStart: string;
  staffMembers: StaffMemberToNotify[];
}

export function StaffToNotifyList({ venueId, weekStart, staffMembers }: StaffToNotifyListProps) {
  const { t } = useTranslation();
  const { timeZone } = useRotaWeek(venueId, weekStart);
  const copyStaffLink = useCopyStaffLink();

  function describe(update: ShiftUpdate) {
    const startsAt = new Date(update.startsAt);
    const day = formatDate(startsAt, { timeZone });
    const times = formatShiftTimes(startsAt, new Date(update.endsAt), { timeZone });
    if (update.kind !== shiftUpdateKind.changed) return t(`rota.notify.update.${update.kind}`, { day, times });
    const previousTimes = formatPreviousShiftTimes(
      { startsAt: new Date(update.previous.startsAt), endsAt: new Date(update.previous.endsAt) },
      startsAt,
      { timeZone },
    );
    return t('rota.notify.update.changed', { day, times, previousTimes });
  }

  if (staffMembers.length === 0) return null;

  return (
    <ul aria-label={t('rota.notify.label')} className="flex max-h-[50vh] flex-col divide-y overflow-y-auto text-sm">
      {staffMembers.map(({ staffMemberId, name, staffLinkToken, updates = [] }) => (
        <li key={staffMemberId} className="flex items-start justify-between gap-3 py-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium">{name}</span>
            {updates.map((update) => (
              <span
                key={`${update.kind}-${update.startsAt}`}
                className="text-muted-foreground tabular-nums"
              >
                {describe(update)}
              </span>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-label={t('rota.notify.copyLabel', { name })}
            onClick={() => void copyStaffLink(staffLinkToken)}
          >
            {t('staffLink.copy')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
