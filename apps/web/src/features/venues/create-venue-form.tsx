import {
  createVenueRequestSchema,
  DEFAULT_TIME_ZONE,
  venueSchema,
  type CreateVenueRequest,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { VenueNameField } from '@/features/venues/venue-name-field';
import { myVenuesQuery, venueQuery } from '@/features/venues/venue-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';

const timeZones = Intl.supportedValuesOf('timeZone');

export function CreateVenueForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(createVenueRequestSchema),
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
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <VenueNameField />
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
          <FieldError>{createVenue.isError && apiErrorMessage(t, createVenue.error)}</FieldError>
        </FieldGroup>
        <Button type="submit" disabled={createVenue.isPending}>
          {t('onboarding.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
