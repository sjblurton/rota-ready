import { z } from 'zod';

export const STAFF_MEMBER_NAME_MAX_LENGTH = 100;
export const STAFF_MEMBER_ROLE_MAX_LENGTH = 50;
export const STAFF_MEMBER_EMAIL_MAX_LENGTH = 254;
export const STAFF_MEMBER_PHONE_MAX_LENGTH = 30;

function blankToNull(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? null : value;
}

function optionalContact<Schema extends z.ZodType<string, string>>(schema: Schema) {
  return z.preprocess(
    blankToNull,
    schema
      .nullish()
      .transform((value) => value ?? null),
  );
}

const contactEmailSchema = optionalContact(
  z.string().trim().toLowerCase().pipe(z.email().max(STAFF_MEMBER_EMAIL_MAX_LENGTH)),
);

const contactPhoneSchema = optionalContact(
  z
    .string()
    .trim()
    .max(STAFF_MEMBER_PHONE_MAX_LENGTH)
    .regex(/^\+?[\d\s()-]*\d[\d\s()-]*$/),
);

export const staffMemberDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(STAFF_MEMBER_NAME_MAX_LENGTH),
    role: z.string().trim().min(1).max(STAFF_MEMBER_ROLE_MAX_LENGTH),
    email: contactEmailSchema,
    phone: contactPhoneSchema,
  })
  .refine(({ email, phone }) => email !== null || phone !== null, { path: ['email'] });

export type StaffMemberDetails = z.input<typeof staffMemberDetailsSchema>;

export const staffMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

export type StaffMember = z.infer<typeof staffMemberSchema>;

export const staffMemberListSchema = z.array(staffMemberSchema);

const nameCollator = new Intl.Collator('en-GB', { sensitivity: 'base', numeric: true });

export function byStaffMemberName(a: { name: string }, b: { name: string }): number {
  return nameCollator.compare(a.name, b.name);
}
