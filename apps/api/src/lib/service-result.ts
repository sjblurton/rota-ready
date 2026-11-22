import type { ApiErrorCode } from '@rota-ready/shared';

export interface Refused<Code extends ApiErrorCode> {
  ok: false;
  code: Code;
}

export function refuse<Code extends ApiErrorCode>(code: Code): Refused<Code> {
  return { ok: false, code };
}
