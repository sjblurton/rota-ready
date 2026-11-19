import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues } from 'react-hook-form';
import type { z } from 'zod';
import { i18n } from '@/i18n/i18n';

function isEmptyText(issue: z.core.$ZodRawIssue): boolean {
  return issue.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) <= 1;
}

export function validationMessage(issue: z.core.$ZodRawIssue): string {
  if (isEmptyText(issue)) return i18n.t('validation.required');

  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null
        ? i18n.t('validation.required')
        : i18n.t('validation.invalid');
    case 'too_small':
      return issue.origin === 'string'
        ? i18n.t('validation.tooShort', { count: Number(issue.minimum) })
        : i18n.t('validation.invalid');
    case 'too_big':
      return i18n.t('validation.tooLong', { count: Number(issue.maximum) });
    case 'invalid_format':
      return issue.format === 'email'
        ? i18n.t('validation.invalidEmail')
        : i18n.t('validation.invalid');
    default:
      return i18n.t('validation.invalid');
  }
}

export function formResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
) {
  return zodResolver(schema, { error: validationMessage });
}
