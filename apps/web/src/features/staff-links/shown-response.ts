import { shiftResponseSchema, type ShiftResponse } from '@rota-ready/shared';

export type ShownResponse = ShiftResponse | 'noReply';

export function shownResponse(response: ShiftResponse, started: boolean): ShownResponse {
  return response === shiftResponseSchema.enum.pending && started ? 'noReply' : response;
}
