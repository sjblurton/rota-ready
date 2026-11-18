import {
  DEFAULT_TIME_ZONE,
  VENUE_NAME_MAX_LENGTH,
  venueSchema,
  type CreateVenueRequest,
} from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';
import { myVenuesQuery, venueQuery } from '@/lib/venues';

export const Route = createFileRoute('/_authenticated/onboarding')({
  beforeLoad: async ({ context }) => {
    const [venue] = await context.queryClient.query(myVenuesQuery);
    if (venue) throw redirect({ to: '/venues/$venueId', params: { venueId: venue.id } });
  },
  component: OnboardingPage,
});

const timeZones = Intl.supportedValuesOf('timeZone');

function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createVenue = useMutation({
    mutationFn: (request: CreateVenueRequest) => apiPost('/api/venues', request, venueSchema),
    onSuccess: async (venue) => {
      queryClient.setQueryData(venueQuery(venue.id).queryKey, venue);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues = []) => [...venues, venue]);
      await navigate({ to: '/venues/$venueId', params: { venueId: venue.id } });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createVenue.mutate({
      name: String(form.get('name')),
      timeZone: String(form.get('timeZone')),
    });
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{t('onboarding.title')}</h1>
          </CardTitle>
          <CardDescription>{t('onboarding.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('venue.name')}</Label>
              <Input id="name" name="name" maxLength={VENUE_NAME_MAX_LENGTH} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeZone">{t('venue.timeZone')}</Label>
              <select
                id="timeZone"
                name="timeZone"
                defaultValue={DEFAULT_TIME_ZONE}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              >
                {timeZones.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
                  </option>
                ))}
              </select>
            </div>
            {createVenue.isError && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(t, createVenue.error)}
              </p>
            )}
            <Button type="submit" disabled={createVenue.isPending}>
              {t('onboarding.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
