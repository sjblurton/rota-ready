import {
  apiErrorCode,
  staffLinkSchema,
  staffLinkShiftSchema,
  type ShiftResponseRequest,
  type StaffLinkShift,
} from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  replaceStaffLinkShift,
  setStaffLink,
  shiftResponsePath,
  staffLinkPath,
} from '@/features/staff-links/staff-link-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, apiPut, hasErrorCode } from '@/lib/api';

interface UseRegenerateStaffLinkOptions {
  onSuccess: () => void;
}

export function useRegenerateStaffLink(
  venueId: string,
  staffMemberId: string,
  { onSuccess }: UseRegenerateStaffLinkOptions,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(`${staffLinkPath(venueId, staffMemberId)}/regenerate`, undefined, staffLinkSchema),
    onSuccess: (staffLink) => {
      onSuccess();
      setStaffLink(queryClient, venueId, staffMemberId, staffLink);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}

interface UseRespondToShiftOptions {
  onSuccess?: () => void;
}

export function useRespondToShift(
  token: string,
  shift: StaffLinkShift,
  { onSuccess }: UseRespondToShiftOptions = {},
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ShiftResponseRequest) =>
      apiPut(shiftResponsePath(token, shift.id), request, staffLinkShiftSchema),
    onSuccess: (updated) => {
      replaceStaffLinkShift(queryClient, token, updated);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
      if (hasErrorCode(error, apiErrorCode.shift_started)) {
        replaceStaffLinkShift(queryClient, token, { ...shift, started: true });
        onSuccess?.();
      }
    },
  });
}
