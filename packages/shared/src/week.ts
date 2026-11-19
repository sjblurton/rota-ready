import { Temporal } from 'temporal-polyfill';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONDAY = 1;

export type Disambiguation = 'compatible' | 'earlier' | 'later';

function zonedDateTimeOf(instant: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timeZone);
}

export function localDateOf(instant: Date, timeZone: string): string {
  return zonedDateTimeOf(instant, timeZone).toPlainDate().toString();
}

export function addDays(localDate: string, days: number): string {
  return Temporal.PlainDate.from(localDate).add({ days }).toString();
}

export function daysBetween(from: string, to: string): number {
  return Temporal.PlainDate.from(from).until(to).days;
}

export function weekStartOf(instant: Date, timeZone: string): string {
  const date = zonedDateTimeOf(instant, timeZone).toPlainDate();
  return date.subtract({ days: date.dayOfWeek - MONDAY }).toString();
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, day) => addDays(weekStart, day));
}

export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}

export function isWeekStart(value: string): boolean {
  return isLocalDate(value) && Temporal.PlainDate.from(value).dayOfWeek === MONDAY;
}

export function zonedTimeToUtc(
  localDate: string,
  time: string,
  timeZone: string,
  disambiguation: Disambiguation = 'compatible',
): Date {
  const instant = Temporal.PlainDate.from(localDate)
    .toPlainDateTime(Temporal.PlainTime.from(time))
    .toZonedDateTime(timeZone, { disambiguation })
    .toInstant();
  return new Date(instant.epochMilliseconds);
}
