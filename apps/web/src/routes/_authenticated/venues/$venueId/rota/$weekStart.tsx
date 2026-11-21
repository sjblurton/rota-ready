import { addDays, formatLocalDate } from '@rota-ready/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RotaGrid } from '@/features/rota/rota-grid';
import { RotaLoadError } from '@/features/rota/rota-load-error';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddShiftForm } from '@/features/rota/add-shift-form';
import { PublishRotaDialog } from '@/features/rota/publish-rota-dialog';
import { WeekLink } from '@/features/rota/week-link';
import { rotaQuery } from '@/features/rota/rota-queries';
import { staffMembersQuery } from '@/features/staff-members/staff-member-queries';

export const Route = createFileRoute('/_authenticated/venues/$venueId/rota/$weekStart')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query(rotaQuery(params.venueId, params.weekStart)),
      context.queryClient.query(staffMembersQuery(params.venueId)),
    ]),
  errorComponent: RotaLoadError,
  component: RotaPage,
});

function RotaPage() {
  const { t } = useTranslation();
  const { venueId, weekStart } = Route.useParams();
  const { data: rota } = useSuspenseQuery(rotaQuery(venueId, weekStart));
  const { data: staffMembers } = useSuspenseQuery(staffMembersQuery(venueId));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {t('rota.weekOf', {
              date: formatLocalDate(rota.weekStart, { withYear: true }),
            })}
          </h2>
          <Badge variant={rota.status === 'published' ? 'default' : 'secondary'}>
            {t(`rota.status.${rota.status}`)}
          </Badge>
          {rota.status === 'draft' && <PublishRotaDialog venueId={venueId} weekStart={weekStart} />}
        </div>
        <div className="flex gap-2">
          <WeekLink venueId={venueId} weekStart={addDays(weekStart, -7)}>
            {t('rota.previousWeek')}
          </WeekLink>
          <WeekLink venueId={venueId} weekStart={addDays(weekStart, 7)}>
            {t('rota.nextWeek')}
          </WeekLink>
        </div>
      </div>
      <Card>
        <CardContent>
          {staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('rota.noStaff')}</p>
          ) : (
            <RotaGrid venueId={venueId} weekStart={rota.weekStart} />
          )}
        </CardContent>
      </Card>
      {staffMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>{t('rota.addShift.title')}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AddShiftForm key={rota.weekStart} venueId={venueId} weekStart={rota.weekStart} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
