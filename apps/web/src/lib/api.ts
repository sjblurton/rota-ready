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
  method: 'GET' | 'PUT' | 'POST' | 'PATCH',
  path: string,
  schema: Schema,
  body?: unknown,
): Promise<z.infer<Schema>> {
  const token = await accessToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    throw new ApiError(response.status, await errorCodeOf(response));
  }
  return schema.parse(response.status === 204 ? undefined : await response.json());
}

export function apiGet<Schema extends z.ZodType>(path: string, schema: Schema) {
  return apiRequest('GET', path, schema);
}

export function apiPut<Schema extends z.ZodType>(path: string, schema: Schema) {
  return apiRequest('PUT', path, schema);
}

export function apiPost<Schema extends z.ZodType>(path: string, body: unknown, schema: Schema) {
  return apiRequest('POST', path, schema, body);
}

export function apiPatch<Schema extends z.ZodType>(path: string, body: unknown, schema: Schema) {
  return apiRequest('PATCH', path, schema, body);
}
