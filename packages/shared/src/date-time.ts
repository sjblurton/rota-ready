import { daysBetween, localDateOf } from './week.js';

export interface DateTimeFormatOptions {
  timeZone: string;
  locale?: string;
}

const DEFAULT_LOCALE = 'en-GB';

export function formatTime(
  instant: Date,
  { timeZone, locale = DEFAULT_LOCALE }: DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

export function formatDate(
  instant: Date,
  { timeZone, locale = DEFAULT_LOCALE }: DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(instant);
}

export function formatShiftTimes(
  startsAt: Date,
  endsAt: Date,
  options: DateTimeFormatOptions,
): string {
  const extraDays = daysBetween(
    localDateOf(startsAt, options.timeZone),
    localDateOf(endsAt, options.timeZone),
  );
  const range = `${formatTime(startsAt, options)}–${formatTime(endsAt, options)}`;
  return extraDays > 0 ? `${range} (+${extraDays})` : range;
}

export function formatEarlierShiftTimes(
  earlier: { startsAt: Date; endsAt: Date },
  laterStartsAt: Date,
  options: DateTimeFormatOptions,
): string {
  const times = formatShiftTimes(earlier.startsAt, earlier.endsAt, options);
  const sameDay =
    localDateOf(earlier.startsAt, options.timeZone) === localDateOf(laterStartsAt, options.timeZone);
  return sameDay ? times : `${formatDate(earlier.startsAt, options)}, ${times}`;
}

export function formatLocalDate(localDate: string, { withYear = false } = {}): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
  }).format(new Date(`${localDate}T12:00:00Z`));
}
