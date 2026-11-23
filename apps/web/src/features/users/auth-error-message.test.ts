import { beforeEach, describe, expect, it } from 'vitest';
import { authErrorBelongsToForm } from './auth-error-message';

describe('authErrorBelongsToForm', () => {
  let belongs: boolean;

  describe.each([
    { scenario: 'a wrong email or password', code: 'invalid_credentials' },
    { scenario: 'an email address not yet confirmed', code: 'email_not_confirmed' },
    { scenario: 'a weak password', code: 'weak_password' },
    { scenario: 'an invalid email address', code: 'email_address_invalid' },
  ])('when Supabase reports $scenario', ({ code }) => {
    beforeEach(() => {
      belongs = authErrorBelongsToForm(code);
    });

    it('keeps the error on the form', () => {
      expect(belongs).toBe(true);
    });
  });

  describe.each([
    { scenario: 'rate limiting', code: 'over_request_rate_limit' },
    { scenario: 'a code we do not know', code: 'unexpected_failure' },
    { scenario: 'an account that already exists', code: 'user_already_exists' },
    { scenario: 'a code that is an object property name', code: 'toString' },
    { scenario: 'no code, as with a network failure', code: undefined },
  ])('when Supabase reports $scenario', ({ code }) => {
    beforeEach(() => {
      belongs = authErrorBelongsToForm(code);
    });

    it('leaves the error for a toast', () => {
      expect(belongs).toBe(false);
    });
  });
});
