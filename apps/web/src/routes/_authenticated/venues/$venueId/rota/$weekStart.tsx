import { addDays, formatLocalDate } from '@rota-ready/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RotaGrid } from '@/components/rota-grid';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { rotaQuery } from '@/lib/rotas';
import { staffMembersQuery } from '@/lib/staff-members';

export const Route = createFileRoute('/_authenticated/venues/$venueId/rota/$weekStart')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query(rotaQuery(params.venueId, params.weekStart)),
      context.queryClient.query(staffMembersQuery(params.venueId)),
    ]),
  errorComponent: RotaError,
  component: RotaPage,
});

function RotaError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive">
        <AlertDescription>{apiErrorMessage(t, error)}</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" asChild>
        <Link to="/venues/$venueId/rota" params={{ venueId }}>
          {t('rota.goToThisWeek')}
        </Link>
      </Button>
    </div>
  );
}

function WeekLink({ weekStart, children }: { weekStart: string; children: string }) {
  const { venueId } = Route.useParams();
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/venues/$venueId/rota/$weekStart" params={{ venueId, weekStart }}>
        {children}
      </Link>
    </Button>
  );
}

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
            {t('rota.weekOf', { date: formatLocalDate(rota.weekStart) })}
          </h2>
          <Badge variant="secondary">{t(`rota.status.${rota.status}`)}</Badge>
        </div>
        <div className="flex gap-2">
          <WeekLink weekStart={addDays(weekStart, -7)}>{t('rota.previousWeek')}</WeekLink>
          <WeekLink weekStart={addDays(weekStart, 7)}>{t('rota.nextWeek')}</WeekLink>
        </div>
      </div>
      <Card>
        <CardContent>
          {staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('rota.noStaff')}</p>
          ) : (
            <RotaGrid weekStart={rota.weekStart} staffMembers={staffMembers} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
