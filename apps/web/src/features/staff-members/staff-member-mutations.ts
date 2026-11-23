import {
  apiErrorCode,
  staffMemberSchema,
  validationMessage,
  type staffMemberDetailsSchema,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  staffMemberPath,
  staffMembersPath,
  updateStaffMembers,
} from '@/features/staff-members/staff-member-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch, apiPost, hasErrorCode } from '@/lib/api';

type StaffMemberForm = UseFormReturn<
  z.input<typeof staffMemberDetailsSchema>,
  unknown,
  StaffMemberDetails
>;

interface UseStaffMemberFormMutationOptions {
  form: StaffMemberForm;
  onSuccess: () => void;
}

function useShowStaffMemberError(form: StaffMemberForm) {
  const { t } = useTranslation();
  return (error: Error) => {
    if (hasErrorCode(error, apiErrorCode.staff_member_email_taken)) {
      form.setError('email', { message: validationMessage.staffMemberEmailTaken });
    } else {
      toast.error(apiErrorMessage(t, error));
    }
  };
}

export function useAddStaffMember(
  venueId: string,
  { form, onSuccess }: UseStaffMemberFormMutationOptions,
) {
  const queryClient = useQueryClient();
  const showError = useShowStaffMemberError(form);
  return useMutation({
    mutationFn: (details: StaffMemberDetails) =>
      apiPost(staffMembersPath(venueId), details, staffMemberSchema),
    onSuccess: (added) => {
      updateStaffMembers(queryClient, venueId, (current) => [...current, added]);
      onSuccess();
    },
    onError: showError,
  });
}

export function useEditStaffMember(
  venueId: string,
  staffMemberId: string,
  { form, onSuccess }: UseStaffMemberFormMutationOptions,
) {
  const queryClient = useQueryClient();
  const showError = useShowStaffMemberError(form);
  return useMutation({
    mutationFn: (details: StaffMemberDetails) =>
      apiPatch(staffMemberPath(venueId, staffMemberId), details, staffMemberSchema),
    onSuccess: (edited) => {
      updateStaffMembers(queryClient, venueId, (current) =>
        current.map((existing) => (existing.id === edited.id ? edited : existing)),
      );
      onSuccess();
    },
    onError: showError,
  });
}

interface UseArchiveStaffMemberOptions {
  onSuccess: () => void;
}

export function useArchiveStaffMember(
  venueId: string,
  staffMemberId: string,
  { onSuccess }: UseArchiveStaffMemberOptions,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(`${staffMemberPath(venueId, staffMemberId)}/archive`, undefined, z.undefined()),
    onSuccess: () => {
      onSuccess();
      updateStaffMembers(queryClient, venueId, (current) =>
        current.filter((existing) => existing.id !== staffMemberId),
      );
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}
