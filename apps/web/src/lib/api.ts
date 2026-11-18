import { apiErrorResponseSchema, type ApiErrorCode } from '@rota-ready/shared';
import type { z } from 'zod';

const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | undefined;

  constructor(status: number, code: ApiErrorCode | undefined) {
    super(`API request failed with ${status}${code ? ` (${code})` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function errorCodeOf(response: Response): Promise<ApiErrorCode | undefined> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.code : undefined;
}

export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new ApiError(response.status, await errorCodeOf(response));
  }
  return schema.parse(await response.json());
}
