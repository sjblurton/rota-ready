export interface DateTimeFormatOptions {
  locale?: string;
  timeZone?: string;
}

const DEFAULT_LOCALE = 'en-GB';
const DEFAULT_TIME_ZONE = 'Europe/London';

export function formatTime(
  instant: Date,
  { locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE }: DateTimeFormatOptions = {},
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
  { locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE }: DateTimeFormatOptions = {},
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
  options: DateTimeFormatOptions = {},
): string {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const extraDays =
    calendarDayNumber(endsAt, timeZone) - calendarDayNumber(startsAt, timeZone);
  const range = `${formatTime(startsAt, options)}–${formatTime(endsAt, options)}`;
  return extraDays > 0 ? `${range} (+${extraDays})` : range;
}
