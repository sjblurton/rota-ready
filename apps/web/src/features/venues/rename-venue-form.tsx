import {
  renameVenueRequestSchema,
  venueSchema,
  type RenameVenueRequest,
  type Venue,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { VenueNameField } from '@/features/venues/venue-name-field';
import { myVenuesQuery, venueQuery } from '@/features/venues/venue-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch } from '@/lib/api';

export function RenameVenueForm({ venue }: { venue: Venue }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(renameVenueRequestSchema),
    defaultValues: { name: venue.name },
  });
  const rename = useMutation({
    mutationFn: (request: RenameVenueRequest) =>
      apiPatch(`/api/venues/${venue.id}`, request, venueSchema),
    onSuccess: (renamed) => {
      queryClient.setQueryData(venueQuery(renamed.id).queryKey, renamed);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues) =>
        venues?.map((existing) => (existing.id === renamed.id ? renamed : existing)),
      );
    },
  });

  function onSubmit(request: RenameVenueRequest) {
    rename.mutate(request);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <VenueNameField />
          <FieldError>{rename.isError && apiErrorMessage(t, rename.error)}</FieldError>
        </FieldGroup>
        <Button type="submit" disabled={rename.isPending}>
          {t('venue.rename.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
