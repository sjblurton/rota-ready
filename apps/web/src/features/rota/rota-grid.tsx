import { formatLocalDate, weekDays, type Shift, type StaffMember } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { layOutShifts } from '@/features/rota/shift-layout';
import { ShiftResponseWithReason } from '@/features/staff-links/shift-response-badge';

interface RotaGridProps {
  weekStart: string;
  timeZone: string;
  staffMembers: StaffMember[];
  shifts: Shift[];
  showResponses: boolean;
}

export function RotaGrid({
  weekStart,
  timeZone,
  staffMembers,
  shifts,
  showResponses,
}: RotaGridProps) {
  const { t } = useTranslation();
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
                  <div key={shift.id} className="flex flex-col items-start gap-1">
                    <span>{times}</span>
                    {showResponses && (
                      <ShiftResponseWithReason
                        response={shift.response}
                        started={shift.started}
                        declineReason={shift.declineReason}
                      />
                    )}
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
