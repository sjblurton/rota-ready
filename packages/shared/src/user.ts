import { z } from 'zod';

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
