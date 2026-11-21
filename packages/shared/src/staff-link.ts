import { z } from 'zod';
import { shiftSchema } from './shift.js';

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

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
