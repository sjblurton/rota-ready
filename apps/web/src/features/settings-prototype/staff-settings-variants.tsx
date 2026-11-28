// PROTOTYPE, throwaway: three layouts for a Staff Member's settings on the existing Staff tab, switched with ?variant=A|B|C.
import type { StaffMember } from '@rota-ready/shared';
import { AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  formatDated,
  formatWeekly,
  roles,
  sampleClash,
  settingsFor,
  shortDays,
  weekdays,
  type StaffSettings,
  type WeeklyUnavailable,
} from './prototype-data';

type Props = { staffMembers: StaffMember[] };

function RolesPicker({ settings }: { settings: StaffSettings }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Roles they can work</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {roles.filter((r) => !r.archived).map((role) => (
          <label key={role.name} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted">
            <input type="checkbox" defaultChecked={settings.roles.includes(role.name)} />
            {role.name}
            {settings.usualRole === role.name && <Badge variant="secondary">usual</Badge>}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        Usual Role
        <NativeSelect defaultValue={settings.usualRole} className="w-48">
          {settings.roles.map((r) => <NativeSelectOption key={r}>{r}</NativeSelectOption>)}
        </NativeSelect>
      </label>
    </fieldset>
  );
}

function UnavailableEditor({ settings, name }: { settings: StaffSettings; name: string }) {
  const [clash, setClash] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Every week</h4>
        {settings.weekly.length === 0 && <p className="text-sm text-muted-foreground">Available any time.</p>}
        <ul className="flex flex-col gap-1">
          {settings.weekly.map((entry, i) => (
            <li key={i} className="flex items-center justify-between rounded border px-3 py-1 text-sm">
              {formatWeekly(entry)} <Button size="sm" variant="ghost">Remove</Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <NativeSelect className="w-40" defaultValue="Tuesday">
            {weekdays.map((d) => <NativeSelectOption key={d}>{d}</NativeSelectOption>)}
            <NativeSelectOption>Monday–Friday</NativeSelectOption>
            <NativeSelectOption>Every day</NativeSelectOption>
          </NativeSelect>
          <NativeSelect className="w-36" defaultValue="all day">
            <NativeSelectOption>all day</NativeSelectOption>
            <NativeSelectOption>before…</NativeSelectOption>
            <NativeSelectOption>after…</NativeSelectOption>
            <NativeSelectOption>between…</NativeSelectOption>
          </NativeSelect>
          <Button size="sm" variant="outline">Add</Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">On dates</h4>
        {settings.dated.length === 0 && <p className="text-sm text-muted-foreground">Nothing coming up.</p>}
        <ul className="flex flex-col gap-1">
          {settings.dated.map((entry, i) => (
            <li key={i} className="flex items-center justify-between rounded border px-3 py-1 text-sm">
              <span>{formatDated(entry)} <span className="text-muted-foreground">{entry.note}</span></span>
              <Button size="sm" variant="ghost">Remove</Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="date" className="w-40" defaultValue="2026-12-07" /> to <Input type="date" className="w-40" defaultValue="2026-12-13" />
          <Input placeholder="Note for you (optional)" className="w-48" />
          <Button size="sm" variant="outline" onClick={() => setClash(true)}>Add</Button>
        </div>
        {clash && (
          <Alert>
            <AlertTriangle />
            <AlertTitle>{name} has {sampleClash.length} Shifts while Unavailable</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {sampleClash.map((s) => (
                  <li key={s.day}><a href="#" className="underline">{s.day}, {s.time}, {s.role}</a></li>
                ))}
              </ul>
              Saved. These Shifts are marked on the Rota until you change them.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

function HoursFields({ settings }: { settings: StaffSettings }) {
  return (
    <div className="flex flex-wrap gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Target Hours per Week</span>
        <Input type="number" defaultValue={settings.targetHours ?? ''} placeholder="None" className="w-28" />
        <span className="text-muted-foreground">What the AI aims for</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Maximum Hours per Week</span>
        <Input type="number" defaultValue={settings.maximumHours ?? ''} placeholder="None" className="w-28" />
        <span className="text-muted-foreground">The AI never goes over this</span>
      </label>
    </div>
  );
}

function NoteField({ settings }: { settings: StaffSettings }) {
  const [note, setNote] = useState(settings.note);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Note for the AI</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Training on Pastry, needs a senior on. Prefers not to close two nights running." />
        <span className="flex justify-between text-muted-foreground">
          <span>Sent to the AI when it drafts a Rota. They never see it. Keep health and personal details out.</span>
          <span>{note.length}/500</span>
        </span>
      </label>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Info className="size-3" /> Rota Ready doesn’t check the extra limits for under-18s. Put them here or check them yourself.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function shortUnavailable(settings: StaffSettings) {
  const parts = [...settings.weekly.map(formatWeekly), ...settings.dated.map(formatDated)];
  return parts.length === 0 ? 'Any time' : parts.join(' · ');
}

export function StaffSettingsA({ staffMembers }: Props) {
  const [editing, setEditing] = useState<string | null>(staffMembers[0]?.id ?? null);
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Staff</h2></CardTitle>
        <CardDescription>Variant A: Edit opens everything about the Staff Member inside their row, as today.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.map((sm, i) => {
              const settings = settingsFor(i);
              return editing === sm.id ? (
                <TableRow key={sm.id}>
                  <TableCell colSpan={4} className="whitespace-normal">
                    <div className="flex flex-col gap-4 py-2">
                      <div className="flex flex-wrap gap-3">
                        <Input defaultValue={sm.name} className="w-48" />
                        <Input defaultValue={sm.email} className="w-64" />
                        <Input defaultValue={sm.phone ?? ''} placeholder="Phone" className="w-40" />
                      </div>
                      <Section title="Roles"><RolesPicker settings={settings} /></Section>
                      <Section title="Unavailable"><UnavailableEditor settings={settings} name={sm.name} /></Section>
                      <Section title="Hours"><HoursFields settings={settings} /></Section>
                      <Section title="Note"><NoteField settings={settings} /></Section>
                      <div className="flex gap-2 border-t pt-4">
                        <Button onClick={() => setEditing(null)}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={sm.id}>
                  <TableCell className="font-medium">{sm.name}</TableCell>
                  <TableCell><Badge variant="secondary">{settings.usualRole}</Badge>{settings.roles.length > 1 && <span className="ml-1 text-xs text-muted-foreground">+{settings.roles.length - 1}</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{sm.email}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setEditing(sm.id)}>Edit</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function StaffSettingsB({ staffMembers }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = staffMembers.findIndex((s) => s.id === openId);
  const open = staffMembers[index];
  if (open) {
    const settings = settingsFor(index);
    return (
      <div className="flex flex-col gap-4">
        <button type="button" className="self-start text-sm underline" onClick={() => setOpenId(null)}>← All staff</button>
        <div>
          <h2 className="text-xl font-semibold">{open.name}</h2>
          <p className="text-sm text-muted-foreground">{settings.usualRole} · {open.email}</p>
        </div>
        <Tabs defaultValue="unavailable">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="unavailable">Unavailable</TabsTrigger>
            <TabsTrigger value="hours">Hours and note</TabsTrigger>
          </TabsList>
          <Card className="mt-3">
            <CardContent className="pt-6">
              <TabsContent value="details" className="flex flex-col gap-3">
                <Input defaultValue={open.name} className="w-64" />
                <Input defaultValue={open.email} className="w-64" />
                <Input defaultValue={open.phone ?? ''} placeholder="Phone" className="w-64" />
              </TabsContent>
              <TabsContent value="roles"><RolesPicker settings={settings} /></TabsContent>
              <TabsContent value="unavailable"><UnavailableEditor settings={settings} name={open.name} /></TabsContent>
              <TabsContent value="hours" className="flex flex-col gap-6"><HoursFields settings={settings} /><NoteField settings={settings} /></TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Staff</h2></CardTitle>
        <CardDescription>Variant B: the list shows a summary; each name opens its own page with tabs.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Unavailable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffMembers.map((sm, i) => {
              const settings = settingsFor(i);
              return (
                <TableRow key={sm.id} className="cursor-pointer" onClick={() => setOpenId(sm.id)}>
                  <TableCell><button type="button" className="font-medium underline-offset-4 hover:underline">{sm.name}</button></TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {settings.roles.map((r) => <Badge key={r} variant={r === settings.usualRole ? 'default' : 'secondary'}>{r}</Badge>)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {settings.targetHours ?? '–'} target · {settings.maximumHours ?? '–'} max
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">{shortUnavailable(settings)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function blocksOn(day: number, weekly: WeeklyUnavailable[]) {
  return weekly.filter((w) => w.day === day || w.day === 'every day' || (w.day === 'weekdays' && day < 5));
}

function cellLabel(entries: WeeklyUnavailable[]) {
  if (entries.length === 0) return '';
  const e = entries[0]!;
  if (e.until && e.from) return `${e.from}–${e.until}`;
  if (e.until) return `before ${e.until}`;
  if (e.from) return `after ${e.from}`;
  return 'all day';
}

export function StaffSettingsC({ staffMembers }: Props) {
  const [detailsFor, setDetailsFor] = useState<number | null>(null);
  const [cells, setCells] = useState<Record<string, boolean>>({});
  const details = detailsFor === null ? undefined : staffMembers[detailsFor];
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle><h2>Who can work when</h2></CardTitle>
          <CardDescription>Variant C: one grid for the whole team. Click a day to mark it Unavailable every week. Names open Roles, hours and note.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium">Name</th>
                {shortDays.map((d) => <th key={d} className="w-20 font-medium">{d}</th>)}
                <th className="text-right font-medium">Target / max</th>
              </tr>
            </thead>
            <tbody>
              {staffMembers.map((sm, i) => {
                const settings = settingsFor(i);
                return (
                  <tr key={sm.id}>
                    <td>
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => setDetailsFor(i)}>{sm.name}</button>
                      <div className="text-xs text-muted-foreground">{settings.roles.join(', ')}</div>
                    </td>
                    {shortDays.map((d, day) => {
                      const key = `${sm.id}-${day}`;
                      const blocks = blocksOn(day, settings.weekly);
                      const toggled = cells[key];
                      const unavailable = toggled ?? blocks.length > 0;
                      const label = toggled === undefined ? cellLabel(blocks) : toggled ? 'all day' : '';
                      return (
                        <td key={d}>
                          <button
                            type="button"
                            aria-label={`${sm.name}, ${weekdays[day]}: ${unavailable ? `Unavailable ${label}` : 'available'}`}
                            onClick={() => setCells({ ...cells, [key]: !unavailable })}
                            className={cn('h-10 w-full rounded text-xs', unavailable ? (label === 'all day' ? 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100' : 'bg-[repeating-linear-gradient(45deg,var(--color-rose-200),var(--color-rose-200)_4px,transparent_4px,transparent_8px)] text-rose-900') : 'bg-emerald-50 dark:bg-emerald-950')}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-right">{settings.targetHours ?? '–'} / {settings.maximumHours ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><h2>Unavailable on dates</h2></CardTitle>
          <CardDescription>Holidays and days off across the team, soonest first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {staffMembers.flatMap((sm, i) => settingsFor(i).dated.map((d) => ({ sm, d }))).map(({ sm, d }, j) => (
            <div key={j} className="flex items-center gap-3 rounded border px-3 py-2 text-sm">
              <span className="w-40 font-medium">{sm.name}</span>
              <span>{formatDated(d)}</span>
              <span className="text-muted-foreground">{d.note}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <NativeSelect className="w-44">
              {staffMembers.map((sm) => <NativeSelectOption key={sm.id}>{sm.name}</NativeSelectOption>)}
            </NativeSelect>
            <Input type="date" className="w-40" /> to <Input type="date" className="w-40" />
            <Button size="sm" variant="outline">Add</Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={details !== undefined} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {details && detailsFor !== null && (
            <>
              <DialogHeader><DialogTitle>{details.name}</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4">
                <RolesPicker settings={settingsFor(detailsFor)} />
                <HoursFields settings={settingsFor(detailsFor)} />
                <NoteField settings={settingsFor(detailsFor)} />
                <Button className="self-start" onClick={() => setDetailsFor(null)}>Save</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const staffSettingsVariants = [
  { key: 'A', name: 'Edit in the row' },
  { key: 'B', name: 'A page per Staff Member' },
  { key: 'C', name: 'Team grid' },
];
