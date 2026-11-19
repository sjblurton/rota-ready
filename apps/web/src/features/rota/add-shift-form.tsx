import {
  addShiftFormSchema,
  formatLocalDate,
  shiftSchema,
  weekDays,
  type CreateShiftRequest,
  type StaffMember,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { addShiftToRota, shiftsPath } from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';

interface AddShiftFormProps {
  venueId: string;
  timeZone: string;
  weekStart: string;
  staffMembers: StaffMember[];
}

export function AddShiftForm({ venueId, timeZone, weekStart, staffMembers }: AddShiftFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(addShiftFormSchema(timeZone)),
    defaultValues: { staffMemberId: '', date: weekStart, startTime: '', endTime: '' },
  });
  const { errors } = form.formState;
  const add = useMutation({
    mutationFn: (request: CreateShiftRequest) =>
      apiPost(shiftsPath(venueId, weekStart), request, shiftSchema),
    onSuccess: (shift) => {
      addShiftToRota(queryClient, venueId, weekStart, shift);
      form.reset({ ...form.getValues(), startTime: '', endTime: '' }, { keepFieldsRef: true });
      form.setFocus('startTime');
    },
  });

  function onSubmit(request: CreateShiftRequest) {
    add.mutate(request);
  }

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.staffMemberId}>
            <FieldLabel htmlFor={`${id}-staffMember`}>{t('rota.staffMember')}</FieldLabel>
            <NativeSelect
              id={`${id}-staffMember`}
              className="w-full"
              aria-invalid={!!errors.staffMemberId}
              aria-describedby={`${id}-staffMember-error`}
              {...form.register('staffMemberId')}
            >
              <NativeSelectOption value="">{t('rota.addShift.chooseStaffMember')}</NativeSelectOption>
              {staffMembers.map((staffMember) => (
                <NativeSelectOption key={staffMember.id} value={staffMember.id}>
                  {staffMember.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={`${id}-staffMember-error`} errors={[errors.staffMemberId]} />
          </Field>
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor={`${id}-date`}>{t('rota.addShift.day')}</FieldLabel>
            <NativeSelect
              id={`${id}-date`}
              className="w-full"
              aria-invalid={!!errors.date}
              aria-describedby={`${id}-date-error`}
              {...form.register('date')}
            >
              {weekDays(weekStart).map((day) => (
                <NativeSelectOption key={day} value={day}>
                  {formatLocalDate(day)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={`${id}-date-error`} errors={[errors.date]} />
          </Field>
          <Field data-invalid={!!errors.startTime}>
            <FieldLabel htmlFor={`${id}-startTime`}>{t('rota.addShift.startTime')}</FieldLabel>
            <Input
              id={`${id}-startTime`}
              type="time"
              aria-invalid={!!errors.startTime}
              aria-describedby={`${id}-startTime-error`}
              {...form.register('startTime')}
            />
            <FieldError id={`${id}-startTime-error`} errors={[errors.startTime]} />
          </Field>
          <Field data-invalid={!!errors.endTime}>
            <FieldLabel htmlFor={`${id}-endTime`}>{t('rota.addShift.endTime')}</FieldLabel>
            <Input
              id={`${id}-endTime`}
              type="time"
              aria-invalid={!!errors.endTime}
              aria-describedby={`${id}-endTime-error`}
              {...form.register('endTime')}
            />
            <FieldError id={`${id}-endTime-error`} errors={[errors.endTime]} />
          </Field>
        </div>
        <FieldError>{add.isError && apiErrorMessage(t, add.error)}</FieldError>
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={add.isPending}>
        {t('rota.addShift.submit')}
      </Button>
    </form>
  );
}
