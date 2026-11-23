import { formatLocalDate } from '@rota-ready/shared';
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
import { useHasUnsentChanges } from '@/features/rota/rota-queries';
import { useSendUpdates } from '@/features/rota/staff-link-email-mutations';
import { StaffLinkEmailResults } from '@/features/rota/staff-link-email-results';

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
      <AlertDialogContent>
        {result ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.sendUpdates.sentTitle', { date })}</AlertDialogTitle>
              <AlertDialogDescription>
                {result.emails.length === 0
                  ? t('rota.sendUpdates.noEmails')
                  : t('rota.sendUpdates.emailsSent')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <StaffLinkEmailResults emails={result.emails} />
            <AlertDialogFooter>
              <AlertDialogAction>{t('rota.sendUpdates.done')}</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.sendUpdates.title', { date })}</AlertDialogTitle>
              <AlertDialogDescription>{t('rota.sendUpdates.description')}</AlertDialogDescription>
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
