import { apiErrorResponseSchema, type ApiErrorCode } from '@rota-ready/shared';
import type { z } from 'zod';
import { accessToken } from './supabase';

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

async function apiRequest<Schema extends z.ZodType>(
  method: 'GET' | 'PUT',
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const token = await accessToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, await errorCodeOf(response));
  }
  return schema.parse(await response.json());
}

export function apiGet<Schema extends z.ZodType>(path: string, schema: Schema) {
  return apiRequest('GET', path, schema);
}

export function apiPut<Schema extends z.ZodType>(path: string, schema: Schema) {
  return apiRequest('PUT', path, schema);
}
