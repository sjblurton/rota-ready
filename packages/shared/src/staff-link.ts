import { z } from 'zod';

export const staffLinkSchema = z.object({
  token: z.string().min(1),
});

export type StaffLink = z.infer<typeof staffLinkSchema>;

export const staffLinkPageSchema = z.object({
  firstName: z.string(),
  venueName: z.string(),
});

export type StaffLinkPage = z.infer<typeof staffLinkPageSchema>;

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
