import { apiErrorCode, askEventName, askEventSchema, askRequestSchema, type AskEvent } from '@rota-ready/shared';
import type { Response } from 'express';
import { parseBody, sendError } from '#src/lib/http-errors.js';
import type { AskService } from './ask-service.js';
import type { AskSettings } from './ask-settings.js';
import type { RotaRequestHandler } from './rota-controller.js';

const EVENT_STREAM_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
};

function writeEvent(res: Response, askEvent: AskEvent) {
  const { event, data } = askEventSchema.parse(askEvent);
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function askController(asks: AskService, { pingIntervalMs }: AskSettings) {
  const askAboutThisWeek: RotaRequestHandler = async (req, res) => {
    const body = parseBody(askRequestSchema, req.body, res);
    if (!body) return;
    const upstream = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) upstream.abort();
    });
    const result = await asks.ask(res.locals.venue, res.locals.userId, req.params.weekStart, body.question, upstream.signal);
    if (!result.ok) return sendError(res, result.code);
    res.writeHead(200, EVENT_STREAM_HEADERS);
    res.flushHeaders();
    const ping = setInterval(() => res.write(': ping\n\n'), pingIntervalMs);
    res.once('close', () => clearInterval(ping));
    try {
      for await (const text of result.answer) writeEvent(res, { event: askEventName.delta, data: { text } });
      writeEvent(res, { event: askEventName.done, data: {} });
    } catch (error) {
      if (upstream.signal.aborted) return;
      res.err = error instanceof Error ? error : new Error(String(error));
      writeEvent(res, { event: askEventName.error, data: { code: apiErrorCode.ask_failed } });
    } finally {
      clearInterval(ping);
    }
    res.end();
  };

  return { askAboutThisWeek };
}
