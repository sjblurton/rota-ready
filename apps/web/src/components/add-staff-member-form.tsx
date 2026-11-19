import {
  staffMemberDetailsSchema,
  staffMemberSchema,
  validationMessage,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StaffMemberFields } from '@/components/staff-member-fields';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';
import { isEmailTaken, staffMembersPath, updateStaffMembers } from '@/lib/staff-members';

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
      if (isEmailTaken(error)) {
        form.setError('email', { message: validationMessage.staffMemberEmailTaken });
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
          <FieldError>
            {add.isError && !isEmailTaken(add.error) && apiErrorMessage(t, add.error)}
          </FieldError>
        </FieldGroup>
        <Button type="submit" className="self-start" disabled={add.isPending}>
          {t('staff.add.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
