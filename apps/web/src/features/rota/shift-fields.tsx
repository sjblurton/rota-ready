import {
  formatLocalDate,
  quarterHourTimes,
  weekDays,
  type shiftFormSchema,
  type StaffMember,
} from '@rota-ready/shared';
import { useId } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

interface ShiftFieldsProps {
  weekStart: string;
  staffMembers: StaffMember[];
}

const times = quarterHourTimes();

export function ShiftFields({ weekStart, staffMembers }: ShiftFieldsProps) {
  const { t } = useTranslation();
  const id = useId();
  const { register, formState, clearErrors } =
    useFormContext<z.input<ReturnType<typeof shiftFormSchema>>>();
  const { errors } = formState;

  function clearFormError() {
    clearErrors('root');
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={!!errors.staffMemberId}>
        <FieldLabel htmlFor={`${id}-staffMember`}>{t('rota.staffMember')}</FieldLabel>
        <NativeSelect
          id={`${id}-staffMember`}
          className="w-full"
          aria-invalid={!!errors.staffMemberId}
          aria-describedby={`${id}-staffMember-error`}
          {...register('staffMemberId', { onChange: clearFormError })}
        >
          <NativeSelectOption value="">{t('rota.shift.chooseStaffMember')}</NativeSelectOption>
          {staffMembers.map((staffMember) => (
            <NativeSelectOption key={staffMember.id} value={staffMember.id}>
              {staffMember.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError id={`${id}-staffMember-error`} errors={[errors.staffMemberId]} />
      </Field>
      <Field data-invalid={!!errors.date}>
        <FieldLabel htmlFor={`${id}-date`}>{t('rota.shift.day')}</FieldLabel>
        <NativeSelect
          id={`${id}-date`}
          className="w-full"
          aria-invalid={!!errors.date}
          aria-describedby={`${id}-date-error`}
          {...register('date', { onChange: clearFormError })}
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
        <FieldLabel htmlFor={`${id}-startTime`}>{t('rota.shift.startTime')}</FieldLabel>
        <NativeSelect
          id={`${id}-startTime`}
          className="w-full"
          aria-invalid={!!errors.startTime}
          aria-describedby={`${id}-startTime-error`}
          {...register('startTime', { onChange: clearFormError })}
        >
          <NativeSelectOption value="">{t('rota.shift.chooseTime')}</NativeSelectOption>
          {times.map((time) => (
            <NativeSelectOption key={time} value={time}>
              {time}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError id={`${id}-startTime-error`} errors={[errors.startTime]} />
      </Field>
      <Field data-invalid={!!errors.endTime}>
        <FieldLabel htmlFor={`${id}-endTime`}>{t('rota.shift.endTime')}</FieldLabel>
        <NativeSelect
          id={`${id}-endTime`}
          className="w-full"
          aria-invalid={!!errors.endTime}
          aria-describedby={`${id}-endTime-error`}
          {...register('endTime', { onChange: clearFormError })}
        >
          <NativeSelectOption value="">{t('rota.shift.chooseTime')}</NativeSelectOption>
          {times.map((time) => (
            <NativeSelectOption key={time} value={time}>
              {time}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError id={`${id}-endTime-error`} errors={[errors.endTime]} />
      </Field>
    </div>
  );
}
