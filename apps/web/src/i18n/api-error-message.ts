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
  rota_has_shifts: 'errors.rotaHasShifts',
  shift_started: 'errors.shiftStarted',
  staff_member_has_upcoming_shifts: 'errors.staffMemberHasUpcomingShifts',
  staff_member_limit_reached: 'errors.staffMemberLimitReached',
  ask_unavailable: 'errors.askUnavailable',
  ask_failed: 'errors.askFailed',
  ask_rate_limited: 'errors.askRateLimited',
  internal_error: 'errors.internal',
} as const satisfies Record<ApiErrorCode, ParseKeys>;

export function apiErrorCodeMessage(t: TFunction, code: ApiErrorCode | undefined): string {
  return code ? t(messageKeys[code]) : t('errors.generic');
}

export function apiErrorMessage(t: TFunction, error: unknown): string {
  return apiErrorCodeMessage(t, error instanceof ApiError ? error.code : undefined);
}
