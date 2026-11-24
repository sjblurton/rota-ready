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
import { useRotaWeek } from '@/features/rota/rota-queries';
import { usePublishRota } from '@/features/rota/notify-staff-mutations';
import { NotifyResultList } from '@/features/rota/notify-result-list';

interface PublishRotaDialogProps {
  venueId: string;
  weekStart: string;
}

export function PublishRotaDialog({ venueId, weekStart }: PublishRotaDialogProps) {
  const { t } = useTranslation();
  const published = useRotaWeek(venueId, weekStart).status === 'published';
  const [open, setOpen] = useState(false);
  const date = formatLocalDate(weekStart, { withYear: true });
  const publish = usePublishRota(venueId, weekStart, { onAlreadyPublished: () => setOpen(false) });
  const result = publish.data;
  const notified = result && (result.plan === plan.pro ? result.emails : result.staffMembers);

  function confirm(event: MouseEvent) {
    event.preventDefault();
    publish.mutate();
  }

  if (published && !open) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {!published && (
        <AlertDialogTrigger asChild>
          <Button size="sm">{t('rota.publish.button')}</Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        {result && notified ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.publish.publishedTitle', { date })}</AlertDialogTitle>
              <AlertDialogDescription>
                {notified.length === 0
                  ? t(`rota.publish.nobodyToNotify.${result.plan}`)
                  : t(`rota.publish.notified.${result.plan}`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <NotifyResultList venueId={venueId} weekStart={weekStart} result={result} />
            <AlertDialogFooter>
              <AlertDialogAction>{t('rota.publish.done')}</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.publish.title', { date })}</AlertDialogTitle>
              <AlertDialogDescription>{t('rota.publish.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('rota.publish.cancel')}</AlertDialogCancel>
              <AlertDialogAction disabled={publish.isPending} onClick={confirm}>
                {t('rota.publish.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
