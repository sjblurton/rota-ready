import type { ApiErrorCode } from '@rota-ready/shared';
import type { ParseKeys, TFunction } from 'i18next';
import { ApiError } from '@/lib/api';

const messageKeys = {
  invalid_request: 'errors.invalidRequest',
  unauthorized: 'errors.unauthorized',
  forbidden: 'errors.forbidden',
  not_found: 'errors.notFound',
  venue_already_exists: 'errors.venueAlreadyExists',
  staff_member_email_taken: 'validation.staffMemberEmailTaken',
  shift_overlaps: 'validation.shiftOverlaps',
  rota_already_published: 'errors.rotaAlreadyPublished',
  rota_not_published: 'errors.rotaNotPublished',
  rota_not_empty: 'errors.rotaNotEmpty',
  shift_started: 'errors.shiftStarted',
  staff_member_has_upcoming_shifts: 'errors.staffMemberHasUpcomingShifts',
  internal_error: 'errors.internal',
} as const satisfies Record<ApiErrorCode, ParseKeys>;

export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code) return t(messageKeys[error.code]);
  return t('errors.generic');
}
