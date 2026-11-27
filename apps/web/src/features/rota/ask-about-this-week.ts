import type { ApiErrorCode, AskEvent } from '@rota-ready/shared';
import { useEffect, useReducer, useRef } from 'react';
import { askEventsFrom } from '@/features/rota/ask-events';
import { ApiError, apiPostStream } from '@/lib/api';
import { createEventStreamParser } from '@/lib/event-stream';

export const askStatus = {
  idle: 'idle',
  streaming: 'streaming',
  answered: 'answered',
  failed: 'failed',
} as const;

const askAction = {
  asked: 'asked',
  received: 'received',
  finished: 'finished',
  failed: 'failed',
} as const;

export type AskState =
  | { status: 'idle' }
  | { status: 'streaming'; answer: string }
  | { status: 'answered'; answer: string }
  | { status: 'failed'; answer: string; code: ApiErrorCode | undefined };

type AskAction =
  | { type: 'asked' }
  | { type: 'received'; text: string }
  | { type: 'finished' }
  | { type: 'failed'; code: ApiErrorCode | undefined };

export function answerOf(state: AskState) {
  return state.status === askStatus.idle ? '' : state.answer;
}

function askReducer(state: AskState, action: AskAction): AskState {
  switch (action.type) {
    case askAction.asked:
      return { status: askStatus.streaming, answer: '' };
    case askAction.received:
      return { status: askStatus.streaming, answer: answerOf(state) + action.text };
    case askAction.finished:
      return { status: askStatus.answered, answer: answerOf(state) };
    case askAction.failed:
      return { status: askStatus.failed, answer: answerOf(state), code: action.code };
  }
}

function actionFor(askEvent: AskEvent): AskAction {
  switch (askEvent.event) {
    case 'delta':
      return { type: askAction.received, text: askEvent.data.text };
    case 'done':
      return { type: askAction.finished };
    case 'error':
      return { type: askAction.failed, code: askEvent.data.code };
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
      const action = actionFor(askEvent);
      dispatch(action);
      if (action.type !== askAction.received) return;
    }
  }
  dispatch({ type: askAction.failed, code: undefined });
}

export function useAskAboutThisWeek(venueId: string, weekStart: string) {
  const [state, dispatch] = useReducer(askReducer, { status: askStatus.idle });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  function ask(question: string) {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    dispatch({ type: askAction.asked });
    streamAnswer(askPath(venueId, weekStart), question, controller.signal, dispatch).catch(
      (error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({ type: askAction.failed, code: error instanceof ApiError ? error.code : undefined });
      },
    );
  }

  return { state, ask };
}
