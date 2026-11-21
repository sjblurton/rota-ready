import { formatDate, formatShiftTimes, type StaffLinkShift } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';

interface UpcomingShiftsProps {
  shifts: StaffLinkShift[];
  timeZone: string;
}

export function UpcomingShifts({ shifts, timeZone }: UpcomingShiftsProps) {
  const { t } = useTranslation();

  if (shifts.length === 0) {
    return <p className="text-muted-foreground">{t('staffLink.page.noShifts')}</p>;
  }

  return (
    <ul aria-label={t('staffLink.page.shifts')} className="flex flex-col gap-2">
      {shifts.map((shift) => {
        const startsAt = new Date(shift.startsAt);
        return (
          <li key={shift.id}>
            <Card size="sm">
              <CardContent className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{formatDate(startsAt, { timeZone })}</span>
                <span className="tabular-nums">
                  {formatShiftTimes(startsAt, new Date(shift.endsAt), { timeZone })}
                </span>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
