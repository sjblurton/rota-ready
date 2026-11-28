import { askEventName, type ApiErrorCode, type AskEvent } from '@rota-ready/shared';
import { useEffect, useReducer, useRef } from 'react';
import { askEventsFrom } from '@/features/rota/ask-events';
import { ApiError, apiPostStream } from '@/lib/api';
import { createEventStreamParser } from '@/lib/event-stream';

export const askStatus = {
  idle: 'idle',
  streaming: 'streaming',
  answered: 'answered',
  stopped: 'stopped',
  failed: 'failed',
} as const;

export type AskState =
  | { status: 'idle' | 'streaming' | 'answered' | 'stopped'; answer: string }
  | { status: 'failed'; answer: string; code: ApiErrorCode | undefined };

const asked = { event: 'asked' } as const;

const stopped = { event: 'stopped' } as const;

type AskAction = AskEvent | typeof asked | typeof stopped | { event: 'error'; data: { code: ApiErrorCode | undefined } };

function failedWith(code: ApiErrorCode | undefined): AskAction {
  return { event: askEventName.error, data: { code } };
}

function askReducer(state: AskState, action: AskAction): AskState {
  switch (action.event) {
    case asked.event:
      return { status: askStatus.streaming, answer: '' };
    case stopped.event:
      return state.status === askStatus.streaming ? { status: askStatus.stopped, answer: state.answer } : state;
    case askEventName.delta:
      return { status: askStatus.streaming, answer: state.answer + action.data.text };
    case askEventName.done:
      return { status: askStatus.answered, answer: state.answer };
    case askEventName.error:
      return { status: askStatus.failed, answer: state.answer, code: action.data.code };
  }
}

function askPath(venueId: string, weekStart: string) {
  return `/api/venues/${venueId}/rotas/${weekStart}/ask`;
}

async function streamAnswer(
  path: string,
  question: string,
  signal: AbortSignal,
  dispatch: (action: AskAction) => void,
) {
  const stream = await apiPostStream(path, { question }, signal);
  const parser = createEventStreamParser();
  for await (const chunk of stream) {
    for (const askEvent of askEventsFrom(parser.push(chunk))) {
      dispatch(askEvent);
      if (askEvent.event !== askEventName.delta) return;
    }
  }
  dispatch(failedWith(undefined));
}

export function useAskAboutThisWeek(venueId: string, weekStart: string) {
  const [state, dispatch] = useReducer(askReducer, { status: askStatus.idle, answer: '' });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  function ask(question: string) {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    dispatch(asked);
    streamAnswer(askPath(venueId, weekStart), question, controller.signal, dispatch).catch(
      (error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch(failedWith(error instanceof ApiError ? error.code : undefined));
      },
    );
  }

  function stop() {
    if (!inFlight.current) return;
    inFlight.current.abort();
    inFlight.current = null;
    dispatch(stopped);
  }

  return { state, ask, stop };
}
