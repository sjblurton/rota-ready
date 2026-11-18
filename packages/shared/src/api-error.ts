import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'venue_already_exists',
  'internal_error',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorResponseSchema = z.object({
  code: apiErrorCodeSchema,
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
