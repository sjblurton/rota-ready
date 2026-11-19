import {
  renameVenueRequestSchema,
  venueSchema,
  type RenameVenueRequest,
} from '@rota-ready/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { VenueNameField } from '@/components/venue-name-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch } from '@/lib/api';
import { myVenuesQuery, venueQuery } from '@/lib/venues';

export const Route = createFileRoute('/_authenticated/venues/$venueId')({
  loader: ({ context, params }) =>
    context.queryClient.query(venueQuery(params.venueId)),
  errorComponent: VenueError,
  component: VenuePage,
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

function VenuePage() {
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
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{venue.name}</h1>
        <p className="text-sm text-muted-foreground">
          {t('venue.timeZoneValue', { timeZone: venue.timeZone })}
        </p>
      </div>
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
    </main>
  );
}
