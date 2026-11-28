import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'venue_already_exists',
  'staff_member_email_taken',
  'shift_overlaps',
  'rota_already_published',
  'rota_not_published',
  'rota_has_shifts',
  'shift_started',
  'staff_member_has_upcoming_shifts',
  'staff_member_limit_reached',
  'ask_unavailable',
  'ask_failed',
  'ask_rate_limited',
  'internal_error',
]);

export const apiErrorCode = apiErrorCodeSchema.enum;

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorResponseSchema = z.object({
  code: apiErrorCodeSchema,
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
