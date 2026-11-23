import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RenameVenueForm } from '@/features/venues/rename-venue-form';

export const Route = createFileRoute('/_authenticated/venues/$venueId/')({
  component: VenueSettingsPage,
});

function VenueSettingsPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t('venue.rename.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RenameVenueForm venueId={venueId} />
      </CardContent>
    </Card>
  );
}
