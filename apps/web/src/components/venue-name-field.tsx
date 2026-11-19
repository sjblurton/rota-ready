import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function VenueNameField() {
  const { t } = useTranslation();
  const { register, formState } = useFormContext<{ name: string }>();
  const error = formState.errors.name;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="name">{t('venue.name')}</FieldLabel>
      <Input
        id="name"
        aria-invalid={!!error}
        aria-describedby="name-error"
        {...register('name')}
      />
      <FieldError id="name-error" errors={[error]} />
    </Field>
  );
}
