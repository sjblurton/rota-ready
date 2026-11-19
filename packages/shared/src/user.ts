import { z } from 'zod';
import { validationMessage } from './validation.js';

export const currentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, validationMessage.required)
    .pipe(z.email(validationMessage.invalidEmail)),
  password: z.string().min(1, validationMessage.required),
});

export type Credentials = z.output<typeof credentialsSchema>;
