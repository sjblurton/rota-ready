import type { ApiErrorCode } from '@rota-ready/shared';
import type { ParseKeys, TFunction } from 'i18next';
import { ApiError } from '@/lib/api';

const messageKeys = {
  unauthorized: 'errors.unauthorized',
  forbidden: 'errors.forbidden',
  not_found: 'errors.notFound',
  internal_error: 'errors.internal',
} as const satisfies Record<ApiErrorCode, ParseKeys>;

export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code) return t(messageKeys[error.code]);
  return t('errors.generic');
}
