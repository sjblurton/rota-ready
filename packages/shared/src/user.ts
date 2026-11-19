import { z } from 'zod';

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export const credentialsSchema = z.object({
  email: z.string().trim().min(1).pipe(z.email()),
  password: z.string().min(1),
});

export type Credentials = z.output<typeof credentialsSchema>;
