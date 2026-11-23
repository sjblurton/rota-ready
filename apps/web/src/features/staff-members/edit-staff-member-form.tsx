import {
  staffMemberDetailsSchema,
  type StaffMember,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StaffMemberFields } from '@/features/staff-members/staff-member-fields';
import { useEditStaffMember } from '@/features/staff-members/staff-member-mutations';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';

interface EditStaffMemberFormProps {
  venueId: string;
  staffMember: StaffMember;
  onDone: () => void;
}

export function EditStaffMemberForm({ venueId, staffMember, onDone }: EditStaffMemberFormProps) {
  const { t } = useTranslation();
  const form = useForm({
    resolver: zodResolver(staffMemberDetailsSchema),
    defaultValues: {
      name: staffMember.name,
      role: staffMember.role,
      email: staffMember.email,
      phone: staffMember.phone ?? '',
    },
  });
  const edit = useEditStaffMember(venueId, staffMember.id, { form, onSuccess: onDone });

  function onSubmit(details: StaffMemberDetails) {
    edit.mutate(details);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <StaffMemberFields />
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
