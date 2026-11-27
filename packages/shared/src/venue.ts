import { z } from 'zod';
import { planSchema } from './plan.js';
import { validationMessage } from './validation.js';

export const DEFAULT_TIME_ZONE = 'Europe/London';
export const VENUE_NAME_MAX_LENGTH = 100;

function canonicalTimeZone(timeZone: string): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export const timeZoneSchema = z.string(validationMessage.required).transform((timeZone, context) => {
  const canonical = canonicalTimeZone(timeZone);
  if (!canonical) {
    context.addIssue({ code: 'custom', message: validationMessage.invalid });
    return z.NEVER;
  }
  return canonical;
});

export const venueNameSchema = z
  .string()
  .trim()
  .min(1, validationMessage.required)
  .max(VENUE_NAME_MAX_LENGTH, validationMessage.venueNameTooLong);

export const venueSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  timeZone: z.string(),
  plan: planSchema,
  canAskAboutThisWeek: z.boolean(),
});

export type Venue = z.infer<typeof venueSchema>;

export const venueListSchema = z.array(venueSchema);

export const createVenueRequestSchema = z.object({
  name: venueNameSchema,
  timeZone: timeZoneSchema,
});

export type CreateVenueRequest = z.output<typeof createVenueRequestSchema>;

export const renameVenueRequestSchema = z.object({
  name: venueNameSchema,
});

export type RenameVenueRequest = z.output<typeof renameVenueRequestSchema>;
