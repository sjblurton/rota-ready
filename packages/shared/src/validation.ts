export const validationMessage = {
  required: 'validation.required',
  invalid: 'validation.invalid',
  invalidEmail: 'validation.invalidEmail',
  venueNameTooLong: 'validation.venueNameTooLong',
} as const;

export type ValidationMessageKey = (typeof validationMessage)[keyof typeof validationMessage];
