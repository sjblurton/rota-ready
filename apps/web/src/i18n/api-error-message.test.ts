import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from './api-error-message';
import { i18n } from './index';

describe('apiErrorMessage', () => {
  let message: string;

  describe('when the API responded with a known error code', () => {
    beforeEach(() => {
      message = apiErrorMessage(i18n.t, new ApiError(404, 'not_found'));
    });

    it('shows the translated message for that code', () => {
      expect(message).toBe("We couldn't find what you were looking for.");
    });
  });

  describe('when the API responded without a code we recognise', () => {
    beforeEach(() => {
      message = apiErrorMessage(i18n.t, new ApiError(418, undefined));
    });

    it('falls back to the generic translated error', () => {
      expect(message).toBe('Something went wrong. Please try again.');
    });
  });

  describe('when the request never reached the API', () => {
    beforeEach(() => {
      message = apiErrorMessage(i18n.t, new TypeError('Failed to fetch'));
    });

    it('falls back to the generic translated error', () => {
      expect(message).toBe('Something went wrong. Please try again.');
    });
  });
});
