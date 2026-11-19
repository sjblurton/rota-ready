import type { ParseKeys, TFunction } from 'i18next';
import { toast } from 'sonner';

const formMessageKeys: Partial<Record<string, ParseKeys>> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_already_exists: 'auth.errors.userAlreadyExists',
  email_exists: 'auth.errors.userAlreadyExists',
  weak_password: 'auth.errors.weakPassword',
  email_address_invalid: 'auth.errors.invalidEmail',
};

const messageKeys: Partial<Record<string, ParseKeys>> = {
  ...formMessageKeys,
  over_request_rate_limit: 'auth.errors.tooManyRequests',
};

export function authErrorBelongsToForm(code: string | undefined): boolean {
  return !!code && Object.hasOwn(formMessageKeys, code);
}

function authErrorMessage(t: TFunction, code: string | undefined): string {
  return t((code && messageKeys[code]) || 'errors.generic');
}

export function formMessageOrToast(t: TFunction, code: string | undefined): string | null {
  if (authErrorBelongsToForm(code)) return authErrorMessage(t, code);
  toast.error(authErrorMessage(t, code));
  return null;
}
