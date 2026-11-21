import {
  shiftFormSchema,
  shiftSchema,
  validationMessage,
  type ShiftRequest,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { addShiftToRota, shiftsPath, useRotaWeek } from '@/features/rota/rota-queries';
import { ShiftFields } from '@/features/rota/shift-fields';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, hasErrorCode } from '@/lib/api';

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
    defaultValues: { staffMemberId: '', date: weekStart, startTime: '', endTime: '' },
  });
  const add = useMutation({
    mutationFn: (request: ShiftRequest) =>
      apiPost(shiftsPath(venueId, weekStart), request, shiftSchema),
    onSuccess: (shift) => {
      addShiftToRota(queryClient, venueId, weekStart, shift);
      form.setFocus('staffMemberId');
    },
    onError: (error) => {
      if (hasErrorCode(error, 'shift_overlaps')) {
        form.setError('root', { message: validationMessage.shiftOverlaps });
      } else {
        toast.error(apiErrorMessage(t, error));
      }
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
