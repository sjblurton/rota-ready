import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RenameVenueForm } from '@/features/venues/rename-venue-form';
import { venueQuery } from '@/features/venues/venue-queries';

export const Route = createFileRoute('/_authenticated/venues/$venueId/')({
  component: VenueSettingsPage,
});

function VenueSettingsPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t('venue.rename.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RenameVenueForm venue={venue} />
      </CardContent>
    </Card>
  );
}
