import { venueSchema, type CreateVenueRequest, type RenameVenueRequest } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { myVenuesQuery, venueQuery } from '@/features/venues/venue-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch, apiPost } from '@/lib/api';

export function useCreateVenue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateVenueRequest) => apiPost('/api/venues', request, venueSchema),
    onSuccess: async (venue) => {
      queryClient.setQueryData(venueQuery(venue.id).queryKey, venue);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues = []) => [...venues, venue]);
      await navigate({ to: '/venues/$venueId', params: { venueId: venue.id } });
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}

export function useRenameVenue(venueId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: RenameVenueRequest) =>
      apiPatch(`/api/venues/${venueId}`, request, venueSchema),
    onSuccess: (renamed) => {
      queryClient.setQueryData(venueQuery(renamed.id).queryKey, renamed);
      queryClient.setQueryData(myVenuesQuery.queryKey, (venues) =>
        venues?.map((existing) => (existing.id === renamed.id ? renamed : existing)),
      );
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}
