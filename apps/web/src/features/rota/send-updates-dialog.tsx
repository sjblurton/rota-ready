import {
  formatLocalDate,
  rotaSchema,
  staffLinkEmailsResultSchema,
  type StaffLinkEmailsResult,
} from '@rota-ready/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { refetchRota, rotaQuery, sendUpdatesPath } from '@/features/rota/rota-queries';
import { StaffLinkEmailResults } from '@/features/rota/staff-link-email-results';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';

interface SendUpdatesDialogProps {
  venueId: string;
  weekStart: string;
}

export function SendUpdatesDialog({ venueId, weekStart }: SendUpdatesDialogProps) {
  const { t } = useTranslation();
  const { data: rota } = useSuspenseQuery(rotaQuery(venueId, weekStart));
  const hasUnsentChanges =
    rota.status === rotaSchema.shape.status.enum.published &&
    (rota.shifts.some(({ changed }) => changed) || rota.removedShifts.length > 0);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<StaffLinkEmailsResult>();
  const date = formatLocalDate(weekStart, { withYear: true });
  const sendUpdates = useMutation({
    mutationFn: () => apiPost(sendUpdatesPath(venueId, weekStart), undefined, staffLinkEmailsResultSchema),
    onSuccess: (sendUpdatesResult) => {
      setResult(sendUpdatesResult);
      refetchRota(queryClient, venueId, weekStart);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });

  function confirm(event: MouseEvent) {
    event.preventDefault();
    sendUpdates.mutate();
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setResult(undefined);
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
