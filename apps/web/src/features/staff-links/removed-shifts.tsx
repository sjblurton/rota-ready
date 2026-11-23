import { formatDate, formatShiftTimes } from '@rota-ready/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { staffLinkPageQuery } from '@/features/staff-links/staff-link-queries';

export function RemovedShifts({ token }: { token: string }) {
  const { t } = useTranslation();
  const {
    data: { removedShifts, timeZone },
  } = useSuspenseQuery(staffLinkPageQuery(token));

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
