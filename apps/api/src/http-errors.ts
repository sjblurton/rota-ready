import type { ApiErrorCode, ApiErrorResponse } from '@rota-ready/shared';
import type { ErrorRequestHandler, Response } from 'express';
import type { z } from 'zod';

const statusByCode = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  venue_already_exists: 409,
  staff_member_email_taken: 409,
  shift_overlaps: 409,
  rota_already_published: 409,
  internal_error: 500,
} as const satisfies Record<ApiErrorCode, number>;

export function sendError(res: Response, code: ApiErrorCode): void {
  res.status(statusByCode[code]).json({ code } satisfies ApiErrorResponse);
}

export function parseBody<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
  res: Response,
): z.output<Schema> | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    sendError(res, 'invalid_request');
    return undefined;
  }
  return parsed.data;
}

export const handleMalformedJson: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed') {
    return sendError(res, 'invalid_request');
  }
  next(error);
};

export const handleUnexpectedError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  res.err = error;
  sendError(res, 'internal_error');
};
