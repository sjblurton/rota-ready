import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { venueQuery } from '@/lib/venues';

export const Route = createFileRoute('/_authenticated/venues/$venueId')({
  loader: ({ context, params }) => context.queryClient.query(venueQuery(params.venueId)),
  errorComponent: VenueError,
  component: VenueLayout,
});

function VenueError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-xl p-6 sm:p-10">
      <Alert variant="destructive">
        <AlertDescription>{apiErrorMessage(t, error)}</AlertDescription>
      </Alert>
    </main>
  );
}

function VenueLayout() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const matchRoute = useMatchRoute();
  const onStaffPage = matchRoute({ to: '/venues/$venueId/staff', params: { venueId } });
  const tab = onStaffPage ? 'staff' : 'settings';

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{venue.name}</h1>
        <p className="text-sm text-muted-foreground">
          {t('venue.timeZoneValue', { timeZone: venue.timeZone })}
        </p>
      </div>
      <Tabs value={tab} activationMode="manual">
        <TabsList aria-label={t('venue.nav.label')}>
          <TabsTrigger value="settings" asChild>
            <Link to="/venues/$venueId" params={{ venueId }}>
              {t('venue.nav.settings')}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="staff" asChild>
            <Link to="/venues/$venueId/staff" params={{ venueId }}>
              {t('venue.nav.staff')}
            </Link>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="text-base">
          <Outlet />
        </TabsContent>
      </Tabs>
    </main>
  );
}
