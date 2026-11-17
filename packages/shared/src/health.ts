import { z } from 'zod';

export const healthResponseSchema = z.object({
  api: z.literal('ok'),
});
