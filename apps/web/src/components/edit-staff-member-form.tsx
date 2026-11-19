import {
  staffMemberDetailsSchema,
  staffMemberSchema,
  validationMessage,
  type StaffMember,
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
import { apiPatch, hasErrorCode } from '@/lib/api';
import { staffMemberPath, updateStaffMembers } from '@/lib/staff-members';

interface EditStaffMemberFormProps {
  venueId: string;
  staffMember: StaffMember;
  onDone: () => void;
}

export function EditStaffMemberForm({ venueId, staffMember, onDone }: EditStaffMemberFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(staffMemberDetailsSchema),
    defaultValues: {
      name: staffMember.name,
      role: staffMember.role,
      email: staffMember.email,
      phone: staffMember.phone ?? '',
    },
  });
  const edit = useMutation({
    mutationFn: (details: StaffMemberDetails) =>
      apiPatch(staffMemberPath(venueId, staffMember.id), details, staffMemberSchema),
    onSuccess: (edited) => {
      updateStaffMembers(queryClient, venueId, (current) =>
        current.map((existing) => (existing.id === edited.id ? edited : existing)),
      );
      onDone();
    },
    onError: (error) => {
      if (hasErrorCode(error, 'staff_member_email_taken')) {
        form.setError('email', { message: validationMessage.staffMemberEmailTaken });
      }
    },
  });

  const emailTaken = hasErrorCode(edit.error, 'staff_member_email_taken');

  function onSubmit(details: StaffMemberDetails) {
    edit.mutate(details);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <StaffMemberFields />
          <FieldError>
            {edit.isError && !emailTaken && apiErrorMessage(t, edit.error)}
          </FieldError>
        </FieldGroup>
        <div className="flex gap-2">
          <Button type="submit" disabled={edit.isPending}>
            {t('staff.edit.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('staff.edit.cancel')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
