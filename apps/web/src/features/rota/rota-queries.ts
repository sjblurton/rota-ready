import { rotaSchema, type Shift } from '@rota-ready/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

const PUBLISHED_ROTA_REFRESH_MS = 30_000;

export function rotaQuery(venueId: string, weekStart: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'rotas', weekStart],
    queryFn: () => apiGet(rotaPath(venueId, weekStart), rotaSchema),
    staleTime: 'static',
    refetchInterval: (query) =>
      query.state.data?.status === 'published' ? PUBLISHED_ROTA_REFRESH_MS : false,
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

export function publishPath(venueId: string, weekStart: string) {
  return `${rotaPath(venueId, weekStart)}/publish`;
}

export function markRotaPublished(queryClient: QueryClient, venueId: string, weekStart: string) {
  queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, (rota) =>
    rota && { ...rota, status: 'published' as const },
  );
}
