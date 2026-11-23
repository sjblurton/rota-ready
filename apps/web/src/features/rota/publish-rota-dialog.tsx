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
import { usePublishRota } from '@/features/rota/staff-link-email-mutations';
import { StaffLinkEmailResults } from '@/features/rota/staff-link-email-results';

interface PublishRotaDialogProps {
  venueId: string;
  weekStart: string;
  published: boolean;
}

export function PublishRotaDialog({ venueId, weekStart, published }: PublishRotaDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const date = formatLocalDate(weekStart, { withYear: true });
  const publish = usePublishRota(venueId, weekStart, { onAlreadyPublished: () => setOpen(false) });
  const result = publish.data;

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
      <AlertDialogContent>
        {result ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rota.publish.publishedTitle', { date })}</AlertDialogTitle>
              <AlertDialogDescription>
                {result.emails.length === 0
                  ? t('rota.publish.noEmails')
                  : t('rota.publish.emailsSent')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <StaffLinkEmailResults emails={result.emails} />
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
