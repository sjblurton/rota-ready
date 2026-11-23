import { renameVenueRequestSchema, type RenameVenueRequest } from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseQuery } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { VenueNameField } from '@/features/venues/venue-name-field';
import { useRenameVenue } from '@/features/venues/venue-mutations';
import { venueQuery } from '@/features/venues/venue-queries';

export function RenameVenueForm({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const form = useForm({
    resolver: zodResolver(renameVenueRequestSchema),
    defaultValues: { name: venue.name },
  });
  const rename = useRenameVenue(venueId);

  function onSubmit(request: RenameVenueRequest) {
    rename.mutate(request);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <VenueNameField />
        </FieldGroup>
        <Button type="submit" disabled={rename.isPending}>
          {t('venue.rename.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
