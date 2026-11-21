import { staffLinkPageSchema, staffLinkSchema, type StaffLink } from '@rota-ready/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { staffMemberPath } from '@/features/staff-members/staff-member-queries';
import { apiGet, hasErrorCode } from '@/lib/api';

const MAX_RETRIES = 3;

export function staffLinkPath(venueId: string, staffMemberId: string) {
  return `${staffMemberPath(venueId, staffMemberId)}/staff-link`;
}

export function staffLinkQuery(venueId: string, staffMemberId: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'staff-members', staffMemberId, 'staff-link'],
    queryFn: () => apiGet(staffLinkPath(venueId, staffMemberId), staffLinkSchema),
    staleTime: 'static',
  });
}

export function setStaffLink(
  queryClient: QueryClient,
  venueId: string,
  staffMemberId: string,
  staffLink: StaffLink,
) {
  queryClient.setQueryData(staffLinkQuery(venueId, staffMemberId).queryKey, staffLink);
}

export function staffLinkUrl(token: string) {
  return new URL(`/s/${token}`, window.location.origin).href;
}

export function staffLinkPageQuery(token: string) {
  return queryOptions({
    queryKey: ['staff-links', token],
    queryFn: () => apiGet(`/api/staff-links/${encodeURIComponent(token)}`, staffLinkPageSchema),
    staleTime: 'static',
    retry: (failureCount, error) => !hasErrorCode(error, 'not_found') && failureCount < MAX_RETRIES,
  });
}
