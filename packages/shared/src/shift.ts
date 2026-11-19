import { z } from 'zod';
import { validationMessage, type ValidationMessageKey } from './validation.js';
import { addDays, isLocalDate, isWeekStart, zonedTimeToUtc } from './week.js';

export const MAX_SHIFT_HOURS = 16;

const HOUR_MS = 3_600_000;
const WALL_CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function shiftEndsAt(
  localDate: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): Date {
  const startsAt = zonedTimeToUtc(localDate, startTime, timeZone);
  const nextDay = zonedTimeToUtc(addDays(localDate, 1), endTime, timeZone);
  const sameDay = [
    zonedTimeToUtc(localDate, endTime, timeZone, 'earlier'),
    zonedTimeToUtc(localDate, endTime, timeZone, 'later'),
  ];
  return sameDay.find((endsAt) => endsAt > startsAt) ?? nextDay;
}

export function shiftTimesIssue(startsAt: Date, endsAt: Date): ValidationMessageKey | null {
  const lengthMs = endsAt.getTime() - startsAt.getTime();
  if (lengthMs <= 0) return validationMessage.shiftEndsBeforeStart;
  if (lengthMs > MAX_SHIFT_HOURS * HOUR_MS) return validationMessage.shiftTooLong;
  return null;
}

function refineShiftTimes(path: string) {
  return (
    { startsAt, endsAt }: { startsAt: string; endsAt: string },
    context: z.RefinementCtx,
  ) => {
    const issue = shiftTimesIssue(new Date(startsAt), new Date(endsAt));
    if (issue) context.addIssue({ code: 'custom', path: [path], message: issue });
  };
}

const wallClockTimeSchema = z
  .string()
  .min(1, { error: validationMessage.required, abort: true })
  .regex(WALL_CLOCK_TIME, validationMessage.invalid);

export const createShiftRequestSchema = z
  .object({
    staffMemberId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .superRefine(refineShiftTimes('endsAt'));

export type CreateShiftRequest = z.output<typeof createShiftRequestSchema>;

export function addShiftFormSchema(timeZone: string) {
  return z
    .object({
      staffMemberId: z.uuid(validationMessage.required),
      date: z.string().refine(isLocalDate, validationMessage.invalid),
      startTime: wallClockTimeSchema,
      endTime: wallClockTimeSchema,
    })
    .transform(({ staffMemberId, date, startTime, endTime }) => ({
      staffMemberId,
      startsAt: zonedTimeToUtc(date, startTime, timeZone).toISOString(),
      endsAt: shiftEndsAt(date, startTime, endTime, timeZone).toISOString(),
    }))
    .superRefine(refineShiftTimes('endTime'));
}

export const shiftSchema = z.object({
  id: z.uuid(),
  staffMemberId: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export type Shift = z.infer<typeof shiftSchema>;

export const rotaSchema = z.object({
  weekStart: z.string().refine(isWeekStart),
  status: z.enum(['draft', 'published']),
  shifts: z.array(shiftSchema),
});

export type Rota = z.infer<typeof rotaSchema>;
