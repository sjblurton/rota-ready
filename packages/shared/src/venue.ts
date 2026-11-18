import { z } from 'zod';

export const DEFAULT_TIME_ZONE = 'Europe/London';
export const VENUE_NAME_MAX_LENGTH = 100;

function canonicalTimeZone(timeZone: string): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export const timeZoneSchema = z.string().transform((timeZone, context) => {
  const canonical = canonicalTimeZone(timeZone);
  if (!canonical) {
    context.addIssue({ code: 'custom', message: 'Unknown time zone' });
    return z.NEVER;
  }
  return canonical;
});

export const venueNameSchema = z.string().trim().min(1).max(VENUE_NAME_MAX_LENGTH);

export const venueSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  timeZone: z.string(),
});

export type Venue = z.infer<typeof venueSchema>;

export const venueListSchema = z.array(venueSchema);

export const createVenueRequestSchema = z.object({
  name: venueNameSchema,
  timeZone: timeZoneSchema,
});

export type CreateVenueRequest = z.input<typeof createVenueRequestSchema>;

export const renameVenueRequestSchema = z.object({
  name: venueNameSchema,
});

export type RenameVenueRequest = z.input<typeof renameVenueRequestSchema>;
