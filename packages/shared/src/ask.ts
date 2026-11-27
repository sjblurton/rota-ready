import { z } from 'zod';
import { apiErrorCodeSchema } from './api-error.js';
import { validationMessage } from './validation.js';

export const ASK_QUESTION_MAX_LENGTH = 500;

export const askRequestSchema = z.object({
  question: z
    .string(validationMessage.required)
    .trim()
    .min(1, validationMessage.required)
    .max(ASK_QUESTION_MAX_LENGTH, validationMessage.questionTooLong),
});

export type AskRequest = z.output<typeof askRequestSchema>;

export const askEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('delta'), data: z.object({ text: z.string() }) }),
  z.object({ event: z.literal('done'), data: z.object({}) }),
  z.object({ event: z.literal('error'), data: z.object({ code: apiErrorCodeSchema }) }),
]);

export type AskEvent = z.infer<typeof askEventSchema>;
