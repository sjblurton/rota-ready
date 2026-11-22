import { formatDate, formatShiftTimes, type RemovedShift } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface RemovedShiftsProps {
  removedShifts: RemovedShift[];
  timeZone: string;
}

export function RemovedShifts({ removedShifts, timeZone }: RemovedShiftsProps) {
  const { t } = useTranslation();

  if (removedShifts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">{t('staffLink.page.removedShifts')}</h2>
      <p className="text-sm text-muted-foreground">{t('staffLink.page.removedDescription')}</p>
      <ul aria-label={t('staffLink.page.removedShifts')} className="flex flex-col gap-2">
        {removedShifts.map((shift) => {
          const startsAt = new Date(shift.startsAt);
          return (
            <li key={shift.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-4 text-muted-foreground line-through">
                    <span className="font-medium">{formatDate(startsAt, { timeZone })}</span>
                    <span className="tabular-nums">
                      {formatShiftTimes(startsAt, new Date(shift.endsAt), { timeZone })}
                    </span>
                  </div>
                  <Badge variant="secondary">{t('staffLink.page.removed')}</Badge>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
