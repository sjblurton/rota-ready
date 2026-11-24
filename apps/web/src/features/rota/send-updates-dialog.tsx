import { formatLocalDate, plan } from '@rota-ready/shared';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useHasUnsentChanges, useRotaWeek } from '@/features/rota/rota-queries';
import { useSendUpdates } from '@/features/rota/notify-staff-mutations';
import { NotifyResultList } from '@/features/rota/notify-result-list';

interface SendUpdatesDialogProps {
  venueId: string;
  weekStart: string;
}

export function SendUpdatesDialog({ venueId, weekStart }: SendUpdatesDialogProps) {
  const { t } = useTranslation();
  const hasUnsentChanges = useHasUnsentChanges(venueId, weekStart);
  const [open, setOpen] = useState(false);
  const sendUpdates = useSendUpdates(venueId, weekStart);
  const result = sendUpdates.data;
  const notified = result && (result.plan === plan.pro ? result.emails : result.staffMembers);
  const venuePlan = useRotaWeek(venueId, weekStart).plan;
  const date = formatLocalDate(weekStart, { withYear: true });

  function confirm(event: MouseEvent) {
    event.preventDefault();
    sendUpdates.mutate();
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) sendUpdates.reset();
  }

  if (!hasUnsentChanges && !open) return null;

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">{t('rota.sendUpdates.button')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        {result && notified ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(`rota.sendUpdates.resultTitle.${result.plan}`, { date })}</AlertDialogTitle>
              <AlertDialogDescription>
                {notified.length === 0
                  ? t(`rota.sendUpdates.nobodyToNotify.${result.plan}`)
                  : t(`rota.sendUpdates.notified.${result.plan}`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <NotifyResultList venueId={venueId} weekStart={weekStart} result={result} />
            <AlertDialogFooter>
              <AlertDialogAction>{t('rota.sendUpdates.done')}</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.sendUpdates.title', { date })}</AlertDialogTitle>
              <AlertDialogDescription>{t(`rota.sendUpdates.description.${venuePlan}`)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('rota.sendUpdates.cancel')}</AlertDialogCancel>
              <AlertDialogAction disabled={sendUpdates.isPending} onClick={confirm}>
                {t('rota.sendUpdates.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
