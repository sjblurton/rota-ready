import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PrototypeSwitcher, usePrototypeVariant } from '@/components/prototype-switcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  VenueSettingsA,
  VenueSettingsB,
  VenueSettingsC,
  VenueSettingsD,
  venueSettingsVariants,
} from '@/features/settings-prototype/venue-settings-variants';
import { RenameVenueForm } from '@/features/venues/rename-venue-form';

export const Route = createFileRoute('/_authenticated/venues/$venueId/')({
  component: VenueSettingsPage,
});

function VenueSettingsPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const variant = usePrototypeVariant(venueSettingsVariants);

  const renameCard = (
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

  return (
    <>
      {variant.key === 'A' && <VenueSettingsA renameCard={renameCard} />}
      {variant.key === 'B' && <VenueSettingsB renameCard={renameCard} />}
      {variant.key === 'C' && <VenueSettingsC renameCard={renameCard} />}
      {variant.key === 'D' && <VenueSettingsD renameCard={renameCard} />}
      <PrototypeSwitcher variants={venueSettingsVariants} />
    </>
  );
}
