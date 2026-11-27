import { beforeEach, describe, expect, it } from 'vitest';
import { createEventStreamParser, type EventStreamMessage } from './event-stream';

describe('createEventStreamParser', () => {
  let messages: EventStreamMessage[];

  describe('when one chunk holds two whole events', () => {
    beforeEach(() => {
      messages = createEventStreamParser().push(
        'event: delta\ndata: {"text":"Sam"}\n\nevent: done\ndata: {}\n\n',
      );
    });

    it('returns both, in order', () => {
      expect(messages).toEqual([
        { event: 'delta', data: '{"text":"Sam"}' },
        { event: 'done', data: '{}' },
      ]);
    });
  });

  describe('when an event is split across three chunks', () => {
    let fromEachChunk: EventStreamMessage[][];

    beforeEach(() => {
      const parser = createEventStreamParser();
      fromEachChunk = ['event: del', 'ta\ndata: {"text":"Sa', 'm"}\n\n'].map((chunk) => parser.push(chunk));
    });

    it('returns nothing until the event is complete, then the whole event', () => {
      expect(fromEachChunk).toEqual([[], [], [{ event: 'delta', data: '{"text":"Sam"}' }]]);
    });
  });

  describe('when the blank line between events is split across chunks', () => {
    let fromEachChunk: EventStreamMessage[][];

    beforeEach(() => {
      const parser = createEventStreamParser();
      fromEachChunk = ['event: done\ndata: {}\n', '\n'].map((chunk) => parser.push(chunk));
    });

    it('returns the event once the blank line arrives', () => {
      expect(fromEachChunk).toEqual([[], [{ event: 'done', data: '{}' }]]);
    });
  });

  describe('when a comment heartbeat arrives between events', () => {
    beforeEach(() => {
      messages = createEventStreamParser().push(': ping\n\nevent: done\ndata: {}\n\n');
    });

    it('skips the heartbeat', () => {
      expect(messages).toEqual([{ event: 'done', data: '{}' }]);
    });
  });

  describe('when an event has no event name', () => {
    beforeEach(() => {
      messages = createEventStreamParser().push('data: hello\n\n');
    });

    it('names it message, as EventSource does', () => {
      expect(messages).toEqual([{ event: 'message', data: 'hello' }]);
    });
  });

  describe('when the stream uses CRLF line endings', () => {
    beforeEach(() => {
      messages = createEventStreamParser().push('event: done\r\ndata: {}\r\n\r\n');
    });

    it('still finds the event', () => {
      expect(messages).toEqual([{ event: 'done', data: '{}' }]);
    });
  });
});
