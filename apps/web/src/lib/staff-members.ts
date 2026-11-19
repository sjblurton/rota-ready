import { staffMemberListSchema } from '@rota-ready/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './api';

export function staffMembersQuery(venueId: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'staff-members'],
    queryFn: () => apiGet(`/api/venues/${venueId}/staff-members`, staffMemberListSchema),
    staleTime: 'static',
  });
}
