import {
  formatLocalDate,
  quarterHourTimes,
  weekDays,
  type shiftFormSchema,
  type StaffMember,
} from '@rota-ready/shared';
import { useId, type ChangeEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

interface ShiftFieldsProps {
  weekStart: string;
  staffMembers: StaffMember[];
}

const times = quarterHourTimes();

export function ShiftFields({ weekStart, staffMembers }: ShiftFieldsProps) {
  const { t } = useTranslation();
  const id = useId();
  const { register, formState, clearErrors, control } =
    useFormContext<z.input<ReturnType<typeof shiftFormSchema>>>();
  const { errors } = formState;
  const staffMemberId = useWatch({ control, name: 'staffMemberId' });
  const usualRole = staffMembers.find((staffMember) => staffMember.id === staffMemberId)?.role;

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
      <ShiftTimeField name="startTime" />
      <ShiftTimeField name="endTime" />
      <Field data-invalid={!!errors.role}>
        <FieldLabel htmlFor={`${id}-role`}>{t('rota.shift.role')}</FieldLabel>
        <Input
          id={`${id}-role`}
          placeholder={usualRole}
          aria-invalid={!!errors.role}
          aria-describedby={`${id}-role-error`}
          {...register('role')}
        />
        <FieldError id={`${id}-role-error`} errors={[errors.role]} />
      </Field>
      <Field data-invalid={!!errors.notes} className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-notes`}>{t('rota.shift.notes')}</FieldLabel>
        <Textarea
          id={`${id}-notes`}
          aria-invalid={!!errors.notes}
          aria-describedby={`${id}-notes-error`}
          {...register('notes')}
        />
        <FieldError id={`${id}-notes-error`} errors={[errors.notes]} />
      </Field>
    </div>
  );
}

const timeLabels = {
  startTime: 'rota.shift.startTime',
  endTime: 'rota.shift.endTime',
} as const;

function ShiftTimeField({ name }: { name: keyof typeof timeLabels }) {
  const { t } = useTranslation();
  const id = useId();
  const { register, formState, clearErrors, getValues, setValue } =
    useFormContext<z.input<ReturnType<typeof shiftFormSchema>>>();
  const error = formState.errors[name];

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    clearErrors('root');
    if (name === 'startTime' && !getValues('endTime')) setValue('endTime', event.target.value);
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{t(timeLabels[name])}</FieldLabel>
      <NativeSelect
        id={id}
        className="w-full"
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
        {...register(name, { onChange })}
      >
        <NativeSelectOption value="">{t('rota.shift.chooseTime')}</NativeSelectOption>
        {times.map((time) => (
          <NativeSelectOption key={time} value={time}>
            {time}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldError id={`${id}-error`} errors={[error]} />
    </Field>
  );
}
