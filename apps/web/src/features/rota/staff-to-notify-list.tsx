import {
  formatDate,
  formatPreviousShiftTimes,
  formatShiftTimes,
  shiftUpdateKind,
  type ShiftUpdate,
  type StaffMemberToNotify,
  type StaffMemberToUpdate,
} from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { useRotaWeek } from '@/features/rota/rota-queries';
import { useCopyStaffLink } from '@/features/staff-links/copy-staff-link';

interface StaffToNotifyListProps {
  venueId: string;
  weekStart: string;
  staffMembers: (StaffMemberToNotify & Partial<Pick<StaffMemberToUpdate, 'updates'>>)[];
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
    <ItemGroup aria-label={t('rota.notify.label')} className="max-h-[50vh] gap-2 overflow-y-auto">
      {staffMembers.map(({ staffMemberId, name, staffLinkToken, updates = [] }) => (
        <Item key={staffMemberId} role="listitem" variant="outline" size="sm" className="flex-nowrap">
          <ItemContent className="min-w-0">
            <ItemTitle>{name}</ItemTitle>
            {updates.map((update) => (
              <ItemDescription key={`${update.kind}-${update.startsAt}`} className="tabular-nums">
                {describe(update)}
              </ItemDescription>
            ))}
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('rota.notify.copyLabel', { name })}
              onClick={() => void copyStaffLink(staffLinkToken)}
            >
              {t('staffLink.copy')}
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
