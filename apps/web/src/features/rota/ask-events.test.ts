import type { AskEvent } from '@rota-ready/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { askEventsFrom } from './ask-events';

describe('askEventsFrom', () => {
  let events: AskEvent[];

  describe('when the stream has a delta, an unknown event, bad JSON and done', () => {
    beforeEach(() => {
      events = askEventsFrom([
        { event: 'delta', data: '{"text":"Sam"}' },
        { event: 'progress', data: '{"percent":50}' },
        { event: 'delta', data: '{"text":' },
        { event: 'done', data: '{}' },
      ]);
    });

    it('keeps the delta and done, and ignores the rest', () => {
      expect(events).toEqual([
        { event: 'delta', data: { text: 'Sam' } },
        { event: 'done', data: {} },
      ]);
    });
  });

  describe('when an error event carries a code', () => {
    beforeEach(() => {
      events = askEventsFrom([{ event: 'error', data: '{"code":"ask_failed"}' }]);
    });

    it('returns the error with its code', () => {
      expect(events).toEqual([{ event: 'error', data: { code: 'ask_failed' } }]);
    });
  });
});
