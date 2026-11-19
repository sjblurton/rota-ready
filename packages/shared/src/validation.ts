export const validationMessage = {
  required: 'validation.required',
  invalid: 'validation.invalid',
  invalidEmail: 'validation.invalidEmail',
  venueNameTooLong: 'validation.venueNameTooLong',
  staffMemberNameTooLong: 'validation.staffMemberNameTooLong',
  staffMemberRoleTooLong: 'validation.staffMemberRoleTooLong',
  invalidPhone: 'validation.invalidPhone',
  staffMemberEmailTaken: 'validation.staffMemberEmailTaken',
} as const;

export type ValidationMessageKey = (typeof validationMessage)[keyof typeof validationMessage];
