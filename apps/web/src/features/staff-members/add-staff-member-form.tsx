import { staffMemberDetailsSchema, type StaffMemberDetails } from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StaffMemberFields } from '@/features/staff-members/staff-member-fields';
import { useAddStaffMember } from '@/features/staff-members/staff-member-mutations';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';

const emptyStaffMember = { name: '', role: '', email: '', phone: '' };

export function AddStaffMemberForm({ venueId }: { venueId: string }) {
  const { t } = useTranslation();
  const form = useForm({
    resolver: zodResolver(staffMemberDetailsSchema),
    defaultValues: emptyStaffMember,
  });
  const add = useAddStaffMember(venueId, {
    form,
    onSuccess: () => {
      form.reset(emptyStaffMember, { keepFieldsRef: true });
      form.setFocus('name');
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
