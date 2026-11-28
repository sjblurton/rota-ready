// PROTOTYPE, throwaway: stub settings data for the settings screens prototype. Nothing here is saved.

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type Period = { start: string; end: string };

export const roles = [
  { name: 'Bar', usualFor: 4, archived: false },
  { name: 'Floor', usualFor: 3, archived: false },
  { name: 'Kitchen', usualFor: 2, archived: false },
  { name: 'Sous Chef', usualFor: 1, archived: false },
  { name: 'Pastry', usualFor: 0, archived: false },
  { name: 'Kitchen Porter', usualFor: 1, archived: false },
  { name: 'Glass Collector', usualFor: 0, archived: true },
];

export const openingHours: Period[][] = [
  [],
  [{ start: '12:00', end: '15:00' }, { start: '17:00', end: '23:00' }],
  [{ start: '12:00', end: '15:00' }, { start: '17:00', end: '23:00' }],
  [{ start: '12:00', end: '23:00' }],
  [{ start: '12:00', end: '01:00' }],
  [{ start: '11:00', end: '01:00' }],
  [{ start: '11:00', end: '22:00' }],
];

export const closeDownMinutes = 60;
export const bankHolidayRegion = 'England and Wales';

export const specialDays = [
  { date: 'Wed 24 Dec 2026', what: 'Open 11:00–18:00', note: 'Christmas Eve' },
  { date: 'Thu 25 Dec 2026', what: 'Closed', note: 'Christmas Day' },
  { date: 'Fri 26 Dec 2026', what: 'Closed', note: '' },
  { date: 'Thu 31 Dec 2026', what: 'Open 12:00–02:00', note: "New Year's Eve party" },
];

export const upcomingBankHolidays = [
  { date: 'Fri 25 Dec 2026', name: 'Christmas Day' },
  { date: 'Mon 28 Dec 2026', name: 'Boxing Day (substitute day)' },
  { date: 'Fri 1 Jan 2027', name: "New Year's Day" },
];

export type ShiftNeed = { day: number; role: string; start: string; end: string; count: number };

export const shiftNeeds: ShiftNeed[] = [
  { day: 1, role: 'Kitchen', start: '09:00', end: '15:00', count: 1 },
  { day: 1, role: 'Bar', start: '17:00', end: 'close', count: 1 },
  { day: 2, role: 'Kitchen', start: '09:00', end: '15:00', count: 1 },
  { day: 2, role: 'Bar', start: '17:00', end: 'close', count: 1 },
  { day: 3, role: 'Kitchen', start: '09:00', end: '17:00', count: 2 },
  { day: 3, role: 'Bar', start: '17:00', end: 'close', count: 2 },
  { day: 3, role: 'Floor', start: '18:00', end: 'close', count: 1 },
  { day: 4, role: 'Kitchen', start: '09:00', end: '17:00', count: 2 },
  { day: 4, role: 'Sous Chef', start: '15:00', end: 'close', count: 1 },
  { day: 4, role: 'Bar', start: '18:00', end: 'close', count: 2 },
  { day: 4, role: 'Floor', start: '18:00', end: 'close', count: 2 },
  { day: 5, role: 'Kitchen', start: '09:00', end: '17:00', count: 2 },
  { day: 5, role: 'Bar', start: '11:00', end: '18:00', count: 1 },
  { day: 5, role: 'Bar', start: '18:00', end: 'close', count: 3 },
  { day: 5, role: 'Floor', start: '17:00', end: 'close', count: 2 },
  { day: 6, role: 'Kitchen', start: '10:00', end: '18:00', count: 1 },
  { day: 6, role: 'Bar', start: '11:00', end: 'close', count: 1 },
];

export function formatPeriods(periods: Period[]) {
  return periods.length === 0 ? 'Closed' : periods.map((p) => `${p.start}–${p.end}`).join(', ');
}

export function formatNeed(need: ShiftNeed) {
  return `${need.role} ${need.start}–${need.end}${need.count > 1 ? ` ×${need.count}` : ''}`;
}

export type WeeklyUnavailable = { day: number | 'weekdays' | 'every day'; from?: string; until?: string };
export type DatedUnavailable = { from: string; to?: string; note: string };

export type StaffSettings = {
  roles: string[];
  usualRole: string;
  weekly: WeeklyUnavailable[];
  dated: DatedUnavailable[];
  targetHours: number | null;
  maximumHours: number | null;
  note: string;
};

const samples: StaffSettings[] = [
  {
    roles: ['Bar', 'Floor'],
    usualRole: 'Bar',
    weekly: [{ day: 1 }],
    dated: [{ from: 'Mon 7 Dec 2026', to: 'Sun 13 Dec 2026', note: 'Spain' }],
    targetHours: 30,
    maximumHours: 40,
    note: 'Prefers not to close two nights running. Can do doubles at weekends.',
  },
  {
    roles: ['Kitchen', 'Pastry'],
    usualRole: 'Kitchen',
    weekly: [{ day: 'weekdays', until: '17:00' }],
    dated: [],
    targetHours: 16,
    maximumHours: 24,
    note: 'Training on Pastry, needs a senior on with her.',
  },
  {
    roles: ['Floor'],
    usualRole: 'Floor',
    weekly: [{ day: 1 }, { day: 3 }],
    dated: [{ from: 'Sat 19 Dec 2026', note: 'Wedding' }],
    targetHours: null,
    maximumHours: 20,
    note: 'Student, term time. 17, no Shifts after 22:00.',
  },
  {
    roles: ['Sous Chef', 'Kitchen'],
    usualRole: 'Sous Chef',
    weekly: [],
    dated: [],
    targetHours: 45,
    maximumHours: 48,
    note: '',
  },
];

export function settingsFor(index: number): StaffSettings {
  return samples[index % samples.length]!;
}

export function formatWeekly(entry: WeeklyUnavailable) {
  const day = typeof entry.day === 'number' ? weekdays[entry.day] : entry.day === 'weekdays' ? 'Monday–Friday' : 'Every day';
  if (entry.from && entry.until) return `${day}, ${entry.from}–${entry.until}`;
  if (entry.until) return `${day}, before ${entry.until}`;
  if (entry.from) return `${day}, after ${entry.from}`;
  return `${day}, all day`;
}

export function formatDated(entry: DatedUnavailable) {
  return entry.to ? `${entry.from} to ${entry.to}` : entry.from;
}

export const sampleClash = [
  { day: 'Tue 8 Dec', time: '17:00–close', role: 'Bar' },
  { day: 'Sat 12 Dec', time: '11:00–18:00', role: 'Bar' },
];
