import { z } from 'zod';

export const validationMessage = {
  required: 'validation.required',
  invalid: 'validation.invalid',
  invalidEmail: 'validation.invalidEmail',
  venueNameTooLong: 'validation.venueNameTooLong',
  staffMemberNameTooLong: 'validation.staffMemberNameTooLong',
  staffMemberRoleTooLong: 'validation.staffMemberRoleTooLong',
  invalidPhone: 'validation.invalidPhone',
  staffMemberEmailTaken: 'validation.staffMemberEmailTaken',
  shiftEndsBeforeStart: 'validation.shiftEndsBeforeStart',
  shiftTooLong: 'validation.shiftTooLong',
  shiftQuarterHour: 'validation.shiftQuarterHour',
  shiftOverlaps: 'validation.shiftOverlaps',
  declineReasonTooLong: 'validation.declineReasonTooLong',
  shiftNotesTooLong: 'validation.shiftNotesTooLong',
} as const;

export type ValidationMessageKey = (typeof validationMessage)[keyof typeof validationMessage];

export function optionalText(maxLength: number, tooLong: ValidationMessageKey) {
  return z
    .string()
    .trim()
    .max(maxLength, tooLong)
    .nullish()
    .transform((text) => text || null);
}
