import { venueListSchema, venueSchema } from '@rota-ready/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export const myVenuesQuery = queryOptions({
  queryKey: ['venues'],
  queryFn: () => apiGet('/api/venues', venueListSchema),
  staleTime: 'static',
});

export function venueQuery(venueId: string) {
  return queryOptions({
    queryKey: ['venues', venueId],
    queryFn: () => apiGet(`/api/venues/${venueId}`, venueSchema),
    staleTime: 'static',
  });
}
