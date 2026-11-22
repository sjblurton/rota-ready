import { formatLocalDate, weekDays } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditShiftDialog } from '@/features/rota/edit-shift-dialog';
import { useRotaWeek } from '@/features/rota/rota-queries';
import { layOutShifts } from '@/features/rota/shift-layout';
import { ShiftResponseWithReason } from '@/features/staff-links/shift-response-badge';

interface RotaGridProps {
  venueId: string;
  weekStart: string;
}

export function RotaGrid({ venueId, weekStart }: RotaGridProps) {
  const { t } = useTranslation();
  const { status, shifts, removedShifts, staffMembers, timeZone } = useRotaWeek(
    venueId,
    weekStart,
  );
  const showResponses = status === 'published';
  const days = weekDays(weekStart);
  const shiftsIn = layOutShifts(shifts, timeZone);
  const removedShiftsIn = layOutShifts(removedShifts, timeZone);

  return (
    <Table aria-label={t('rota.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('rota.staffMember')}</TableHead>
          {days.map((day) => (
            <TableHead key={day}>{formatLocalDate(day)}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {staffMembers.map((staffMember) => (
          <TableRow key={staffMember.id}>
            <TableCell className="align-top">
              <div className="flex flex-col">
                <span className="font-medium">{staffMember.name}</span>
                <span className="text-xs text-muted-foreground">{staffMember.role}</span>
              </div>
            </TableCell>
            {days.map((day) => (
              <TableCell key={day} className="align-top">
                {shiftsIn(staffMember.id, day).map(({ shift, times }) => (
                  <div key={shift.id} className="flex flex-col items-start gap-1">
                    <EditShiftDialog
                      venueId={venueId}
                      weekStart={weekStart}
                      shift={shift}
                      times={times}
                    />
                    {shift.role && <span className="text-xs font-medium">{shift.role}</span>}
                    {shift.notes && (
                      <p className="text-xs whitespace-pre-line text-muted-foreground">
                        {shift.notes}
                      </p>
                    )}
                    {showResponses && (
                      <div className="flex flex-wrap items-center gap-1">
                        <ShiftResponseWithReason
                          response={shift.response}
                          started={shift.started}
                          declineReason={shift.declineReason}
                        />
                        {shift.changed && (
                          <Badge variant="secondary">{t('rota.changed')}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {removedShiftsIn(staffMember.id, day).map(({ shift, times }) => (
                  <div key={shift.id} className="flex flex-col items-start gap-1">
                    <span className="text-sm text-muted-foreground line-through">{times}</span>
                    <Badge variant="secondary">{t('rota.removed')}</Badge>
                  </div>
                ))}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
