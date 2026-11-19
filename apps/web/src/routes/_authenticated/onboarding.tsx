import {
  createVenueRequestSchema,
  DEFAULT_TIME_ZONE,
  venueSchema,
  type CreateVenueRequest,
} from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';
import { formResolver } from '@/lib/form-resolver';
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
  const form = useForm({
    resolver: formResolver(createVenueRequestSchema),
    defaultValues: { name: '', timeZone: DEFAULT_TIME_ZONE },
  });
  const { errors } = form.formState;
  const createVenue = useMutation({
    mutationFn: (request: CreateVenueRequest) => apiPost('/api/venues', request, venueSchema),
    onSuccess: async (venue) => {
      queryClient.setQueryData(venueQuery(venue.id).queryKey, venue);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues = []) => [...venues, venue]);
      await navigate({ to: '/venues/$venueId', params: { venueId: venue.id } });
    },
  });

  function onSubmit(request: CreateVenueRequest) {
    createVenue.mutate(request);
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
          <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">{t('venue.name')}</FieldLabel>
                <Input
                  id="name"
                  aria-invalid={!!errors.name}
                  aria-describedby="name-error"
                  {...form.register('name')}
                />
                <FieldError id="name-error" errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.timeZone}>
                <FieldLabel htmlFor="timeZone">{t('venue.timeZone')}</FieldLabel>
                <NativeSelect
                  id="timeZone"
                  className="w-full"
                  aria-invalid={!!errors.timeZone}
                  aria-describedby="timeZone-error"
                  {...form.register('timeZone')}
                >
                  {timeZones.map((timeZone) => (
                    <NativeSelectOption key={timeZone} value={timeZone}>
                      {timeZone}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id="timeZone-error" errors={[errors.timeZone]} />
              </Field>
            </FieldGroup>
            {createVenue.isError && (
              <Alert variant="destructive">
                <AlertDescription>{apiErrorMessage(t, createVenue.error)}</AlertDescription>
              </Alert>
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
