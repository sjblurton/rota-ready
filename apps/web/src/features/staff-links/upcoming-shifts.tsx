import {
  formatDate,
  formatPreviousShiftTimes,
  formatShiftTimes,
  type StaffLinkShift,
} from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RespondToShift } from '@/features/staff-links/respond-to-shift';
import { ShiftResponseBadge } from '@/features/staff-links/shift-response-badge';

interface UpcomingShiftsProps {
  token: string;
  shifts: StaffLinkShift[];
  timeZone: string;
}

export function UpcomingShifts({ token, shifts, timeZone }: UpcomingShiftsProps) {
  const { t } = useTranslation();

  if (shifts.length === 0) {
    return <p className="text-muted-foreground">{t('staffLink.page.noShifts')}</p>;
  }

  return (
    <ul aria-label={t('staffLink.page.shifts')} className="flex flex-col gap-2">
      {shifts.map((shift) => {
        const startsAt = new Date(shift.startsAt);
        const day = formatDate(startsAt, { timeZone });
        const times = formatShiftTimes(startsAt, new Date(shift.endsAt), { timeZone });
        const previousTimes =
          shift.previous &&
          formatPreviousShiftTimes(
            { startsAt: new Date(shift.previous.startsAt), endsAt: new Date(shift.previous.endsAt) },
            startsAt,
            { timeZone },
          );
        return (
          <li key={shift.id}>
            <Card size="sm">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{day}</span>
                  <span className="tabular-nums">{times}</span>
                </div>
                {previousTimes && (
                  <p className="text-right text-sm text-muted-foreground tabular-nums">
                    {t('staffLink.page.previousTimes', { times: previousTimes })}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <ShiftResponseBadge response={shift.response} started={shift.started} />
                    {shift.changed && <Badge variant="secondary">{t('staffLink.page.changed')}</Badge>}
                  </div>
                  <RespondToShift token={token} shift={shift} day={day} times={times} />
                </div>
                {shift.declineReason && (
                  <p className="text-sm text-muted-foreground">{shift.declineReason}</p>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
