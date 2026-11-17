import { z } from 'zod';

export const healthResponseSchema = z.object({
  api: z.literal('ok'),
  db: z.enum(['ok', 'down']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
