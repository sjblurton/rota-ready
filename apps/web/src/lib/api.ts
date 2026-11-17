import type { z } from 'zod';

const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? '';

/** Fetches an API path and parses the JSON body with its shared Zod schema. */
export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return schema.parse(await response.json());
}
