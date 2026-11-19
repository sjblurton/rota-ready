import { z } from 'zod';
import { validationMessage, type ValidationMessageKey } from './validation.js';
import { addDays, isLocalDate, isWeekStart, zonedTimeToUtc } from './week.js';

export const MAX_SHIFT_HOURS = 16;
export const QUARTER_HOUR_MINUTES = 15;

const HOUR_MS = 3_600_000;
const WALL_CLOCK_TIME = /^([01]\d|2[0-3]):(?<minutes>[0-5]\d)$/;

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

function isOnQuarterHour(minutes: number) {
  return minutes % QUARTER_HOUR_MINUTES === 0;
}

type ShiftInterval = Pick<Shift, 'startsAt' | 'endsAt'>;

function shiftsOverlap(a: ShiftInterval, b: ShiftInterval): boolean {
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);
}

function refineShiftTimes(path: string) {
  return ({ startsAt, endsAt }: ShiftInterval, context: z.RefinementCtx) => {
    const issue = shiftTimesIssue(new Date(startsAt), new Date(endsAt));
    if (issue) context.addIssue({ code: 'custom', path: [path], message: issue });
  };
}

const wallClockTimeSchema = z
  .string()
  .min(1, { error: validationMessage.required, abort: true })
  .regex(WALL_CLOCK_TIME, { error: validationMessage.invalid, abort: true })
  .refine(
    (time) => isOnQuarterHour(Number(WALL_CLOCK_TIME.exec(time)?.groups?.minutes)),
    validationMessage.shiftQuarterHour,
  );

const shiftInstantSchema = z.iso.datetime().refine((value) => {
  const instant = new Date(value);
  return (
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0 &&
    isOnQuarterHour(instant.getUTCMinutes())
  );
}, validationMessage.shiftQuarterHour);

export const createShiftRequestSchema = z
  .object({
    staffMemberId: z.uuid(),
    startsAt: shiftInstantSchema,
    endsAt: shiftInstantSchema,
  })
  .superRefine(refineShiftTimes('endsAt'));

export type CreateShiftRequest = z.output<typeof createShiftRequestSchema>;

export function addShiftFormSchema(
  timeZone: string,
  existingShifts: Pick<Shift, 'staffMemberId' | 'startsAt' | 'endsAt'>[] = [],
) {
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
    .superRefine(refineShiftTimes('endTime'))
    .superRefine((shift, context) => {
      const overlaps = existingShifts.some(
        (existing) =>
          existing.staffMemberId === shift.staffMemberId && shiftsOverlap(existing, shift),
      );
      if (overlaps) {
        context.addIssue({
          code: 'custom',
          path: ['root'],
          message: validationMessage.shiftOverlaps,
        });
      }
    });
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
