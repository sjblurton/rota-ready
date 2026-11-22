import { rotaSchema, type Shift } from '@rota-ready/shared';
import { queryOptions, useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { staffMembersQuery } from '@/features/staff-members/staff-member-queries';
import { venueQuery } from '@/features/venues/venue-queries';
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

export function useRotaWeek(venueId: string, weekStart: string) {
  const { data: rota } = useSuspenseQuery(rotaQuery(venueId, weekStart));
  const { data: staffMembers } = useSuspenseQuery(staffMembersQuery(venueId));
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  return {
    status: rota.status,
    shifts: rota.shifts,
    removedShifts: rota.removedShifts,
    staffMembers,
    timeZone: venue.timeZone,
  };
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

export function shiftPath(venueId: string, weekStart: string, shiftId: string) {
  return `${shiftsPath(venueId, weekStart)}/${shiftId}`;
}

export function replaceShiftInRota(
  queryClient: QueryClient,
  venueId: string,
  weekStart: string,
  shift: Shift,
) {
  queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, (rota) =>
    rota && {
      ...rota,
      shifts: rota.shifts.map((existing) => (existing.id === shift.id ? shift : existing)),
    },
  );
}

export function removeShiftFromRota(
  queryClient: QueryClient,
  venueId: string,
  weekStart: string,
  shiftId: string,
) {
  queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, (rota) =>
    rota && { ...rota, shifts: rota.shifts.filter((existing) => existing.id !== shiftId) },
  );
}

export function refetchRota(queryClient: QueryClient, venueId: string, weekStart: string) {
  queryClient.query({ ...rotaQuery(venueId, weekStart), staleTime: 0 }).catch(() => undefined);
}

export function publishPath(venueId: string, weekStart: string) {
  return `${rotaPath(venueId, weekStart)}/publish`;
}

export function markRotaPublished(queryClient: QueryClient, venueId: string, weekStart: string) {
  queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, (rota) =>
    rota && { ...rota, status: 'published' as const },
  );
}
