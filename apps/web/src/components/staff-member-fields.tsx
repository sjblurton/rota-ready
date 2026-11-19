import type { staffMemberDetailsSchema } from '@rota-ready/shared';
import { useId } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function StaffMemberFields() {
  // reset() unregisters the fields, and React Hook Form re-registers them only when register()
  // runs again on the next render. The compiler would skip those calls, leaving the inputs dead.
  'use no memo';
  const { t } = useTranslation();
  const id = useId();
  const { register, formState } = useFormContext<z.input<typeof staffMemberDetailsSchema>>();
  const { errors } = formState;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor={`${id}-name`}>{t('staff.name')}</FieldLabel>
        <Input
          id={`${id}-name`}
          aria-invalid={!!errors.name}
          aria-describedby={`${id}-name-error`}
          {...register('name')}
        />
        <FieldError id={`${id}-name-error`} errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.role}>
        <FieldLabel htmlFor={`${id}-role`}>{t('staff.role')}</FieldLabel>
        <Input
          id={`${id}-role`}
          aria-invalid={!!errors.role}
          aria-describedby={`${id}-role-error`}
          {...register('role')}
        />
        <FieldError id={`${id}-role-error`} errors={[errors.role]} />
      </Field>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor={`${id}-email`}>{t('staff.email')}</FieldLabel>
        <Input
          id={`${id}-email`}
          type="email"
          aria-invalid={!!errors.email}
          aria-describedby={`${id}-email-error`}
          {...register('email')}
        />
        <FieldError id={`${id}-email-error`} errors={[errors.email]} />
      </Field>
      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor={`${id}-phone`}>{t('staff.phone')}</FieldLabel>
        <Input
          id={`${id}-phone`}
          type="tel"
          aria-invalid={!!errors.phone}
          aria-describedby={`${id}-phone-error`}
          {...register('phone')}
        />
        <FieldError id={`${id}-phone-error`} errors={[errors.phone]} />
      </Field>
    </div>
  );
}
