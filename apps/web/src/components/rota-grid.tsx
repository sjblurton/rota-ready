import { formatLocalDate, weekDays, type StaffMember } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RotaGridProps {
  weekStart: string;
  staffMembers: StaffMember[];
}

export function RotaGrid({ weekStart, staffMembers }: RotaGridProps) {
  const { t } = useTranslation();
  const days = weekDays(weekStart);

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
              <TableCell key={day} />
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
