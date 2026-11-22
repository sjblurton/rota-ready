import {
  apiErrorCode,
  staffMemberDetailsSchema,
  staffMemberSchema,
  validationMessage,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { StaffMemberFields } from '@/features/staff-members/staff-member-fields';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, hasErrorCode } from '@/lib/api';
import { staffMembersPath, updateStaffMembers } from '@/features/staff-members/staff-member-queries';

const emptyStaffMember = { name: '', role: '', email: '', phone: '' };

export function AddStaffMemberForm({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(staffMemberDetailsSchema),
    defaultValues: emptyStaffMember,
  });
  const add = useMutation({
    mutationFn: (details: StaffMemberDetails) =>
      apiPost(staffMembersPath(venueId), details, staffMemberSchema),
    onSuccess: (added) => {
      updateStaffMembers(queryClient, venueId, (current) => [...current, added]);
      form.reset(emptyStaffMember, { keepFieldsRef: true });
      form.setFocus('name');
    },
    onError: (error) => {
      if (hasErrorCode(error, apiErrorCode.staff_member_email_taken)) {
        form.setError('email', { message: validationMessage.staffMemberEmailTaken });
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });

  function onSubmit(details: StaffMemberDetails) {
    add.mutate(details);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <StaffMemberFields />
        </FieldGroup>
        <Button type="submit" className="self-start" disabled={add.isPending}>
          {t('staff.add.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
