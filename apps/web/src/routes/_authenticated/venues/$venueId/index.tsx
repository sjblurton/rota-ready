import {
  renameVenueRequestSchema,
  venueSchema,
  type RenameVenueRequest,
} from '@rota-ready/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { VenueNameField } from '@/components/venue-name-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch } from '@/lib/api';
import { myVenuesQuery, venueQuery } from '@/lib/venues';

export const Route = createFileRoute('/_authenticated/venues/$venueId/')({
  component: VenueSettingsPage,
});

function VenueSettingsPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(renameVenueRequestSchema),
    defaultValues: { name: venue.name },
  });
  const rename = useMutation({
    mutationFn: (request: RenameVenueRequest) =>
      apiPatch(`/api/venues/${venueId}`, request, venueSchema),
    onSuccess: (renamed) => {
      queryClient.setQueryData(venueQuery(venueId).queryKey, renamed);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues) =>
        venues?.map((venue) => (venue.id === renamed.id ? renamed : venue)),
      );
    },
  });

  function onSubmit(request: RenameVenueRequest) {
    rename.mutate(request);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('venue.rename.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
