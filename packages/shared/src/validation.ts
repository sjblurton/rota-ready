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
} as const;

export type ValidationMessageKey = (typeof validationMessage)[keyof typeof validationMessage];
