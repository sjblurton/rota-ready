import { byStaffMemberName, staffMemberListSchema, type StaffMember } from '@rota-ready/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiGet } from './api';

export function staffMembersQuery(venueId: string) {
  return queryOptions({
    queryKey: ['venues', venueId, 'staff-members'],
    queryFn: () => apiGet(staffMembersPath(venueId), staffMemberListSchema),
    staleTime: 'static',
  });
}

export function staffMembersPath(venueId: string) {
  return `/api/venues/${venueId}/staff-members`;
}

export function staffMemberPath(venueId: string, staffMemberId: string) {
  return `${staffMembersPath(venueId)}/${staffMemberId}`;
}

export function isEmailTaken(error: unknown) {
  return error instanceof ApiError && error.code === 'staff_member_email_taken';
}

export function updateStaffMembers(
  queryClient: QueryClient,
  venueId: string,
  update: (staffMembers: StaffMember[]) => StaffMember[],
) {
  queryClient.setQueryData(staffMembersQuery(venueId).queryKey, (current = []) =>
    update(current).sort(byStaffMemberName),
  );
}
