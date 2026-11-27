import type { ApiErrorCode } from '@rota-ready/shared';
import { useEffect, useReducer, useRef } from 'react';
import { askEventsFrom } from '@/features/rota/ask-events';
import { ApiError, apiPostStream } from '@/lib/api';
import { createEventStreamParser } from '@/lib/event-stream';

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

function answerOf(state: AskState) {
  return state.status === 'idle' ? '' : state.answer;
}

function askReducer(state: AskState, action: AskAction): AskState {
  switch (action.type) {
    case 'asked':
      return { status: 'streaming', answer: '' };
    case 'received':
      return { status: 'streaming', answer: answerOf(state) + action.text };
    case 'finished':
      return { status: 'answered', answer: answerOf(state) };
    case 'failed':
      return { status: 'failed', answer: answerOf(state), code: action.code };
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
      if (askEvent.event === 'delta') dispatch({ type: 'received', text: askEvent.data.text });
      if (askEvent.event === 'error') return dispatch({ type: 'failed', code: askEvent.data.code });
      if (askEvent.event === 'done') return dispatch({ type: 'finished' });
    }
  }
  dispatch({ type: 'failed', code: undefined });
}

export function useAskAboutThisWeek(venueId: string, weekStart: string) {
  const [state, dispatch] = useReducer(askReducer, { status: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  function ask(question: string) {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    dispatch({ type: 'asked' });
    streamAnswer(askPath(venueId, weekStart), question, controller.signal, dispatch).catch(
      (error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'failed', code: error instanceof ApiError ? error.code : undefined });
      },
    );
  }

  return { state, ask };
}
