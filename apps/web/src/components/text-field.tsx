import type { ComponentProps } from 'react';
import type { FieldError as FormFieldError } from 'react-hook-form';
import { z } from 'zod';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface TextFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error: FormFieldError | undefined;
  schema: z.ZodType;
}

function textSchemaOf(schema: z.ZodType): z.ZodString | undefined {
  if (schema instanceof z.ZodString) return schema;
  if (schema instanceof z.ZodPipe) return textSchemaOf(schema.in as z.ZodType);
  return undefined;
}

export function TextField({ id, label, error, schema, ...inputProps }: TextFieldProps) {
  const text = textSchemaOf(schema);
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        required={(text?.minLength ?? 0) > 0}
        maxLength={text?.maxLength ?? undefined}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      <FieldError id={errorId} errors={[error]} />
    </Field>
  );
}
