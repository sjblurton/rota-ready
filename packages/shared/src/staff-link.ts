import { z } from 'zod';
import { shiftSchema } from './shift.js';
import { optionalText, validationMessage } from './validation.js';

export const DECLINE_REASON_MAX_LENGTH = 200;

export const staffLinkSchema = z.object({
  token: z.string().min(1),
});

export type StaffLink = z.infer<typeof staffLinkSchema>;

export const staffLinkShiftSchema = shiftSchema.omit({ staffMemberId: true }).extend({
  previous: shiftSchema.pick({ startsAt: true, endsAt: true }).nullable(),
});

export type StaffLinkShift = z.infer<typeof staffLinkShiftSchema>;

export const removedShiftSchema = shiftSchema.pick({ id: true, startsAt: true, endsAt: true });

export type RemovedShift = z.infer<typeof removedShiftSchema>;

export const staffLinkPageSchema = z.object({
  firstName: z.string(),
  venueName: z.string(),
  timeZone: z.string(),
  shifts: z.array(staffLinkShiftSchema),
  removedShifts: z.array(removedShiftSchema),
});

export type StaffLinkPage = z.infer<typeof staffLinkPageSchema>;

const declineReasonSchema = optionalText(
  DECLINE_REASON_MAX_LENGTH,
  validationMessage.declineReasonTooLong,
);

export const declineFormSchema = z.object({ declineReason: declineReasonSchema });

export const shiftResponseRequestSchema = z.discriminatedUnion('response', [
  z.object({ response: z.literal('confirmed') }),
  z.object({ response: z.literal('declined'), declineReason: declineReasonSchema }),
]);

export type ShiftResponseRequest = z.output<typeof shiftResponseRequestSchema>;

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
