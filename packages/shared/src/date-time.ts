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

function calendarDayNumber(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / 86_400_000;
}

export function formatShiftTimes(
  startsAt: Date,
  endsAt: Date,
  options: DateTimeFormatOptions,
): string {
  const extraDays =
    calendarDayNumber(endsAt, options.timeZone) -
    calendarDayNumber(startsAt, options.timeZone);
  const range = `${formatTime(startsAt, options)}–${formatTime(endsAt, options)}`;
  return extraDays > 0 ? `${range} (+${extraDays})` : range;
}
