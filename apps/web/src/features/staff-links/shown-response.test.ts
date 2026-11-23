import type { ShiftResponse } from '@rota-ready/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { shownResponse, type ShownResponse } from './shown-response';

describe('shownResponse', () => {
  let shown: ShownResponse;

  describe('when a Pending Shift has started', () => {
    beforeEach(() => {
      shown = shownResponse('pending', true);
    });

    it('shows No reply', () => {
      expect(shown).toBe('noReply');
    });
  });

  describe('when a Pending Shift has not started', () => {
    beforeEach(() => {
      shown = shownResponse('pending', false);
    });

    it('shows Pending', () => {
      expect(shown).toBe('pending');
    });
  });

  describe.each<ShiftResponse>(['confirmed', 'declined'])('when a %s Shift has started', (response) => {
    beforeEach(() => {
      shown = shownResponse(response, true);
    });

    it('keeps showing its response', () => {
      expect(shown).toBe(response);
    });
  });
});
