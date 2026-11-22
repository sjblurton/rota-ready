import { shiftFormSchema, shiftSchema, type ShiftRequest } from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { addShiftToRota, shiftsPath, useRotaWeek } from '@/features/rota/rota-queries';
import { ShiftFields } from '@/features/rota/shift-fields';
import { useShiftMutation } from '@/features/rota/shift-mutation';
import { apiPost } from '@/lib/api';

interface AddShiftFormProps {
  venueId: string;
  weekStart: string;
}

export function AddShiftForm({ venueId, weekStart }: AddShiftFormProps) {
  const { t } = useTranslation();
  const { shifts, staffMembers, timeZone } = useRotaWeek(venueId, weekStart);
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(shiftFormSchema(timeZone, shifts)),
    defaultValues: {
      staffMemberId: '',
      date: weekStart,
      startTime: '',
      endTime: '',
      role: '',
      notes: '',
    },
  });
  const add = useShiftMutation({
    form,
    send: (request) => apiPost(shiftsPath(venueId, weekStart), request, shiftSchema),
    onSuccess: (shift) => {
      addShiftToRota(queryClient, venueId, weekStart, shift);
      form.setFocus('staffMemberId');
    },
  });

  function onSubmit(request: ShiftRequest) {
    add.mutate(request);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <ShiftFields weekStart={weekStart} staffMembers={staffMembers} />
          <FieldError errors={[form.formState.errors.root]} />
        </FieldGroup>
        <Button type="submit" className="self-start" disabled={add.isPending}>
          {t('rota.addShift.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
