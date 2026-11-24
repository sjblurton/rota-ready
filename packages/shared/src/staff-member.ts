import { z } from 'zod';
import { validationMessage } from './validation.js';

export const STAFF_MEMBER_NAME_MAX_LENGTH = 100;
export const STAFF_MEMBER_ROLE_MAX_LENGTH = 50;
export const STAFF_MEMBER_EMAIL_MAX_LENGTH = 254;
export const STAFF_MEMBER_PHONE_MAX_LENGTH = 30;
export const FREE_PLAN_STAFF_MEMBER_LIMIT = 15;

const PHONE_NUMBER = /^\+?[\d\s()-]*\d[\d\s()-]*$/;

export const staffMemberDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, validationMessage.required)
    .max(STAFF_MEMBER_NAME_MAX_LENGTH, validationMessage.staffMemberNameTooLong),
  role: z
    .string()
    .trim()
    .min(1, validationMessage.required)
    .max(STAFF_MEMBER_ROLE_MAX_LENGTH, validationMessage.staffMemberRoleTooLong),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, validationMessage.required)
    .pipe(
      z
        .email(validationMessage.invalidEmail)
        .max(STAFF_MEMBER_EMAIL_MAX_LENGTH, validationMessage.invalidEmail),
    ),
  phone: z
    .string()
    .trim()
    .max(STAFF_MEMBER_PHONE_MAX_LENGTH, validationMessage.invalidPhone)
    .refine((phone) => phone === '' || PHONE_NUMBER.test(phone), validationMessage.invalidPhone)
    .nullish()
    .transform((phone) => phone || null),
});

export type StaffMemberDetails = z.output<typeof staffMemberDetailsSchema>;

export const staffMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
});

export type StaffMember = z.infer<typeof staffMemberSchema>;

export const staffMemberListSchema = z.array(staffMemberSchema);

const nameCollator = new Intl.Collator('en-GB', { sensitivity: 'base', numeric: true });

export function byStaffMemberName(a: { name: string }, b: { name: string }): number {
  return nameCollator.compare(a.name, b.name);
}
