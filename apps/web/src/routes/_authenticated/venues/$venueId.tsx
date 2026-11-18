import {
  VENUE_NAME_MAX_LENGTH,
  venueSchema,
  type RenameVenueRequest,
} from '@rota-ready/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <p role="alert">{apiErrorMessage(t, error)}</p>
    </main>
  );
}

function VenuePage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const queryClient = useQueryClient();
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    rename.mutate({ name: String(form.get('name')) });
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
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('venue.name')}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={venue.name}
                maxLength={VENUE_NAME_MAX_LENGTH}
                required
              />
            </div>
            {rename.isError && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(t, rename.error)}
              </p>
            )}
            <Button type="submit" disabled={rename.isPending}>
              {t('venue.rename.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
