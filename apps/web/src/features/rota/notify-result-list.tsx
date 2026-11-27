import { notifiedBy, type PublishResult, type SendUpdatesResult } from '@rota-ready/shared';
import { StaffLinkEmailResults } from '@/features/rota/staff-link-email-results';
import { StaffToNotifyList } from '@/features/rota/staff-to-notify-list';

interface NotifyResultListProps {
  venueId: string;
  weekStart: string;
  result: PublishResult | SendUpdatesResult;
}

export function NotifyResultList({ venueId, weekStart, result }: NotifyResultListProps) {
  if (result.notifiedBy === notifiedBy.rota_ready) return <StaffLinkEmailResults emails={result.emails} />;
  return (
    <StaffToNotifyList venueId={venueId} weekStart={weekStart} staffMembers={result.staffMembers} />
  );
}
