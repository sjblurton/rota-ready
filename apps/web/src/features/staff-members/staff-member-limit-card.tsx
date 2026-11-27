import { planAllows } from '@rota-ready/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { staffMembersQuery } from '@/features/staff-members/staff-member-queries';
import { venueQuery } from '@/features/venues/venue-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StaffMemberLimitCard({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const { data: staffMembers } = useSuspenseQuery(staffMembersQuery(venueId));
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));

  return (
    <Card role="status">
      <CardHeader>
        <CardTitle>
          <h2>{t('staff.limit.title', { staffMemberLimit: planAllows[venue.plan].staffMemberLimit })}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('staff.limit.description', { staffMemberCount: staffMembers.length })}
        </p>
      </CardContent>
    </Card>
  );
}
