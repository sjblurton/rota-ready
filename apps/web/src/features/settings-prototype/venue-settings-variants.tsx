// PROTOTYPE, throwaway: three Venue settings layouts on the existing Settings tab, switched with ?variant=A|B|C.
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  bankHolidayRegion,
  closeDownMinutes,
  formatNeed,
  formatPeriods,
  openingHours,
  roles,
  shiftNeeds,
  shortDays,
  specialDays,
  upcomingBankHolidays,
  weekdays,
} from './prototype-data';

function RolesList() {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-md border">
        {roles.map((role) => (
          <li key={role.name} className={cn('flex items-center justify-between gap-2 px-3 py-2', role.archived && 'text-muted-foreground')}>
            <span className="font-medium">
              {role.name} {role.archived && <Badge variant="outline">Archived</Badge>}
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {role.usualFor > 0 ? `usual Role for ${role.usualFor}` : 'nobody’s usual Role'}
              {!role.archived && (
                <>
                  <Button size="sm" variant="ghost">Rename</Button>
                  <Button size="sm" variant="ghost">Merge…</Button>
                  <Button size="sm" variant="ghost" disabled={role.usualFor > 0}>Archive</Button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="New Role, e.g. Barista" className="max-w-xs" />
        <Button variant="outline">Add Role</Button>
      </div>
      <p className="text-sm text-muted-foreground">{roles.filter((r) => !r.archived).length} of 50 Roles</p>
    </div>
  );
}

function OpeningHoursTable() {
  return (
    <Table>
      <TableBody>
        {weekdays.map((day, i) => (
          <TableRow key={day}>
            <TableCell className="w-32 font-medium">{day}</TableCell>
            <TableCell>
              {openingHours[i]!.length === 0 ? (
                <span className="text-muted-foreground">Closed</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {openingHours[i]!.map((p) => (
                    <span key={p.start} className="flex items-center gap-1">
                      <Input defaultValue={p.start} className="w-20" /> – <Input defaultValue={p.end} className="w-20" />
                    </span>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="ghost">+ Period</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CloseDownAndBankHolidays() {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Close-down Time</span>
        <span className="flex items-center gap-2">
          <Input type="number" defaultValue={closeDownMinutes} className="w-24" /> minutes after the Venue closes
        </span>
        <span className="text-muted-foreground">Until Close Shifts end this long after closing.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bank Holidays</span>
        <NativeSelect defaultValue={bankHolidayRegion} className="w-64">
          <NativeSelectOption>England and Wales</NativeSelectOption>
          <NativeSelectOption>Scotland</NativeSelectOption>
          <NativeSelectOption>Northern Ireland</NativeSelectOption>
        </NativeSelect>
        <span className="text-muted-foreground">Next: {upcomingBankHolidays.map((b) => `${b.name} (${b.date})`).join(', ')}</span>
      </label>
    </div>
  );
}

function SpecialDaysList() {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y rounded-md border">
        {specialDays.map((day) => (
          <li key={day.date} className="flex items-center justify-between px-3 py-2">
            <span>
              <span className="font-medium">{day.date}</span> <span className="text-muted-foreground">{day.note}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge variant={day.what === 'Closed' ? 'destructive' : 'secondary'}>{day.what}</Badge>
              <Button size="sm" variant="ghost">Edit</Button>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="self-start">Add Special Day</Button>
    </div>
  );
}

function ShiftNeedsTable() {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Times</TableHead>
            <TableHead>People</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shiftNeeds.map((need, i) => (
            <TableRow key={i}>
              <TableCell>{weekdays[need.day]}</TableCell>
              <TableCell>{need.role}</TableCell>
              <TableCell>{need.start}–{need.end}</TableCell>
              <TableCell>{need.count}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost">Edit</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="outline" className="self-start">Add Shift Need</Button>
      <p className="text-sm text-muted-foreground">Optional. Without Shift Needs, the AI follows your last 4 Weeks.</p>
    </div>
  );
}

const sections = [
  { id: 'roles', title: 'Roles', description: 'The jobs at this Venue.', body: RolesList, summary: `${roles.filter((r) => !r.archived).length} Roles` },
  { id: 'hours', title: 'Opening Hours', description: 'When customers are served, each week.', body: OpeningHoursTable, summary: 'Open 6 days' },
  { id: 'special', title: 'Special Days', description: 'Dates when the Venue is closed or has different hours.', body: SpecialDaysList, summary: `${specialDays.length} coming up` },
  { id: 'close', title: 'Close-down and Bank Holidays', description: 'How long closing takes, and which Bank Holidays apply.', body: CloseDownAndBankHolidays, summary: `${closeDownMinutes} min · ${bankHolidayRegion}` },
  { id: 'needs', title: 'Shift Needs', description: 'The Shifts you want filled every week.', body: ShiftNeedsTable, summary: `${shiftNeeds.length} each week` },
];

export function VenueSettingsA({ renameCard }: { renameCard: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      <nav className="sticky top-6 hidden h-fit w-48 flex-col gap-1 text-sm md:flex">
        <a href="#venue" className="rounded px-2 py-1 hover:bg-muted">Venue</a>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded px-2 py-1 hover:bg-muted">{s.title}</a>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div id="venue">{renameCard}</div>
        {sections.map((s) => (
          <Card key={s.id} id={s.id}>
            <CardHeader>
              <CardTitle><h2>{s.title}</h2></CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent><s.body /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function VenueSettingsB({ renameCard }: { renameCard: React.ReactNode }) {
  const [open, setOpen] = useState('venue');
  const current = sections.find((s) => s.id === open);
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <ul className="flex flex-col divide-y rounded-lg border">
        <li>
          <button type="button" onClick={() => setOpen('venue')} className={cn('w-full px-4 py-3 text-left', open === 'venue' && 'bg-muted')}>
            <div className="font-medium">Venue</div>
            <div className="text-sm text-muted-foreground">Name and timezone</div>
          </button>
        </li>
        {sections.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => setOpen(s.id)} className={cn('w-full px-4 py-3 text-left', open === s.id && 'bg-muted')}>
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.summary}</div>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        {current ? (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold">{current.title}</h2>
              <p className="text-sm text-muted-foreground">{current.description}</p>
            </div>
            <current.body />
            <div className="flex gap-2 border-t pt-4">
              <Button>Save {current.title}</Button>
              <Button variant="ghost">Cancel</Button>
            </div>
          </section>
        ) : (
          renameCard
        )}
      </div>
    </div>
  );
}

const timelineStart = 6;
const timelineHours = 21;

function toOffset(time: string, isEnd: boolean) {
  const [h, m] = time.split(':').map(Number) as [number, number];
  let hours = h + m / 60;
  if (hours < timelineStart || (isEnd && hours === timelineStart)) hours += 24;
  return ((hours - timelineStart) / timelineHours) * 100;
}

function DayColumn({ day }: { day: number }) {
  const periods = openingHours[day]!;
  const needs = shiftNeeds.filter((n) => n.day === day);
  const closed = periods.length === 0;
  return (
    <div className={cn('flex min-w-36 flex-col gap-2 rounded-lg border p-2', closed && 'bg-muted/50')}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{shortDays[day]}</span>
        <button type="button" className="text-xs text-muted-foreground underline">edit</button>
      </div>
      <div className="relative h-3 rounded bg-muted" title={formatPeriods(periods)}>
        {periods.map((p) => {
          const left = toOffset(p.start, false);
          const right = toOffset(p.end, true);
          return <div key={p.start} className="absolute inset-y-0 rounded bg-emerald-500" style={{ left: `${left}%`, width: `${right - left}%` }} />;
        })}
      </div>
      <div className="text-xs text-muted-foreground">{formatPeriods(periods)}</div>
      <div className="flex flex-col gap-1">
        {needs.map((need, i) => (
          <div key={i} className="rounded border-l-4 border-sky-500 bg-sky-50 px-2 py-1 text-xs dark:bg-sky-950">
            {formatNeed(need)}
          </div>
        ))}
        {!closed && (
          <button type="button" className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">
            + Shift Need
          </button>
        )}
        {closed && <span className="text-xs text-muted-foreground">Closed every week</span>}
      </div>
    </div>
  );
}

export function VenueSettingsC({ renameCard }: { renameCard: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">{renameCard}</div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle><h2>Roles</h2></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {roles.filter((r) => !r.archived).map((r) => (
              <Badge key={r.name} variant="secondary" className="gap-1 text-sm">{r.name}</Badge>
            ))}
            <Button size="sm" variant="outline">Manage Roles</Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle><h2>A usual week</h2></CardTitle>
          <CardDescription>
            Green bars are Opening Hours (06:00 to 03:00). Blue cards are Shift Needs: the Shifts you want filled every week. Until Close ends {closeDownMinutes} minutes after closing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 overflow-x-auto pb-2">
          {weekdays.map((_, i) => <DayColumn key={i} day={i} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><h2>Dates that are different</h2></CardTitle>
          <CardDescription>Special Days you’ve added, and Bank Holidays for {bankHolidayRegion} (change)</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative flex flex-col gap-2 border-l pl-4">
            {[...specialDays.map((d) => ({ date: d.date, label: d.note || 'Special Day', badge: d.what, kind: 'special' })), ...upcomingBankHolidays.map((b) => ({ date: b.date, label: b.name, badge: 'Bank Holiday', kind: 'bank' }))]
              .sort((a, b) => Date.parse(a.date.slice(4)) - Date.parse(b.date.slice(4)))
              .map((item) => (
                <li key={item.date + item.label} className="flex items-center gap-3">
                  <span className="w-28 text-sm font-medium">{item.date}</span>
                  <span>{item.label}</span>
                  <Badge variant={item.kind === 'bank' ? 'outline' : item.badge === 'Closed' ? 'destructive' : 'secondary'}>{item.badge}</Badge>
                  {item.kind === 'bank' && <Button size="sm" variant="ghost">Make it a Special Day</Button>}
                </li>
              ))}
          </ol>
          <Button variant="outline" className="mt-4">Add Special Day</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export const venueSettingsVariants = [
  { key: 'A', name: 'One long page' },
  { key: 'B', name: 'Section list' },
  { key: 'C', name: 'A usual week' },
];
