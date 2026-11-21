import { z } from 'zod';
import { shiftSchema } from './shift.js';
import { validationMessage } from './validation.js';

export const DECLINE_REASON_MAX_LENGTH = 200;

export const staffLinkSchema = z.object({
  token: z.string().min(1),
});

export type StaffLink = z.infer<typeof staffLinkSchema>;

export const staffLinkShiftSchema = shiftSchema.omit({ staffMemberId: true });

export type StaffLinkShift = z.infer<typeof staffLinkShiftSchema>;

export const staffLinkPageSchema = z.object({
  firstName: z.string(),
  venueName: z.string(),
  timeZone: z.string(),
  shifts: z.array(staffLinkShiftSchema),
});

export type StaffLinkPage = z.infer<typeof staffLinkPageSchema>;

const declineReasonSchema = z
  .string()
  .trim()
  .max(DECLINE_REASON_MAX_LENGTH, validationMessage.declineReasonTooLong)
  .nullish()
  .transform((reason) => reason || null);

export const declineFormSchema = z.object({ declineReason: declineReasonSchema });

export const shiftResponseRequestSchema = z.discriminatedUnion('response', [
  z.object({ response: z.literal('confirmed') }),
  z.object({ response: z.literal('declined'), declineReason: declineReasonSchema }),
]);

export type ShiftResponseRequest = z.output<typeof shiftResponseRequestSchema>;

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
