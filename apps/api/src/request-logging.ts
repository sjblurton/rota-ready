import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { sendError } from './http-errors.js';

const STAFF_LINK_PATH = /^(\/api\/staff-links\/)[^/]+/i;

function loggablePath(url: string): string {
  const [path = '/'] = url.split('?');
  return path.replace(STAFF_LINK_PATH, '$1[redacted]');
}

export function requestLogging(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    customLogLevel: (_req, res, error) =>
      (error || res.statusCode >= 500) ? 'error' : 'info',
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        path: loggablePath(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}

export const handleUnexpectedError: ErrorRequestHandler = (error, req, res, _next) => {
  const err = error instanceof Error ? error : new Error(String(error));
  if (res.writableEnded) {
    req.log.error({ err }, 'request errored after the response was sent');
    return;
  }
  res.err = err;
  if (res.headersSent) {
    res.end();
    return;
  }
  sendError(res, 'internal_error');
};
