import type { ApiErrorCode, ApiErrorResponse } from '@rota-ready/shared';
import type { Response } from 'express';

const statusByCode = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  internal_error: 500,
} as const satisfies Record<ApiErrorCode, number>;

export function sendError(res: Response, code: ApiErrorCode): void {
  res.status(statusByCode[code]).json({ code } satisfies ApiErrorResponse);
}
