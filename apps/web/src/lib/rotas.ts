import { rotaSchema } from '@rota-ready/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './api';

export function rotaQuery(venueId: string, weekStart: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'rotas', weekStart],
    queryFn: () => apiGet(`/api/venues/${venueId}/rotas/${weekStart}`, rotaSchema),
    staleTime: 'static',
  });
}
