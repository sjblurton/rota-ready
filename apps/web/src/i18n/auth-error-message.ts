import type { ParseKeys, TFunction } from 'i18next';

const messageKeys: Partial<Record<string, ParseKeys>> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_already_exists: 'auth.errors.userAlreadyExists',
  email_exists: 'auth.errors.userAlreadyExists',
  weak_password: 'auth.errors.weakPassword',
  email_address_invalid: 'auth.errors.invalidEmail',
  over_request_rate_limit: 'auth.errors.tooManyRequests',
};

export function authErrorMessage(t: TFunction, code: string | undefined): string {
  return t((code && messageKeys[code]) || 'errors.generic');
}
