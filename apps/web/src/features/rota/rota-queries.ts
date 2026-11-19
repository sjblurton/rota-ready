import { rotaSchema, type Shift } from '@rota-ready/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export function rotaQuery(venueId: string, weekStart: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'rotas', weekStart],
    queryFn: () => apiGet(rotaPath(venueId, weekStart), rotaSchema),
    staleTime: 'static',
  });
}

function rotaPath(venueId: string, weekStart: string) {
  return `/api/venues/${venueId}/rotas/${weekStart}`;
}

export function shiftsPath(venueId: string, weekStart: string) {
  return `${rotaPath(venueId, weekStart)}/shifts`;
}

export function addShiftToRota(
  queryClient: QueryClient,
  venueId: string,
  weekStart: string,
  shift: Shift,
) {
  queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, (rota) =>
    rota && { ...rota, shifts: [...rota.shifts, shift] },
  );
}
