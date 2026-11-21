import { formatLocalDate, weekDays } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
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

interface RotaGridProps {
  venueId: string;
  weekStart: string;
}

export function RotaGrid({ venueId, weekStart }: RotaGridProps) {
  const { t } = useTranslation();
  const { shifts, staffMembers, timeZone } = useRotaWeek(venueId, weekStart);
  const days = weekDays(weekStart);
  const shiftsIn = layOutShifts(shifts, timeZone);

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
            <TableCell className="font-medium">{staffMember.name}</TableCell>
            {days.map((day) => (
              <TableCell key={day} className="align-top">
                {shiftsIn(staffMember.id, day).map(({ shift, times }) => (
                  <div key={shift.id}>
                    <EditShiftDialog
                      venueId={venueId}
                      weekStart={weekStart}
                      shift={shift}
                      times={times}
                    />
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
