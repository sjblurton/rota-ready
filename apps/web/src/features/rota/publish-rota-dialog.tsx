import {
  apiErrorCode,
  emailStatusSchema,
  formatLocalDate,
  publishResultSchema,
  type PublishResult,
} from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { markRotaPublished, publishPath } from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, hasErrorCode } from '@/lib/api';

interface PublishRotaDialogProps {
  venueId: string;
  weekStart: string;
  published: boolean;
}

export function PublishRotaDialog({ venueId, weekStart, published }: PublishRotaDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PublishResult>();
  const date = formatLocalDate(weekStart, { withYear: true });
  const publish = useMutation({
    mutationFn: () => apiPost(publishPath(venueId, weekStart), undefined, publishResultSchema),
    onSuccess: (publishResult) => {
      setResult(publishResult);
      markRotaPublished(queryClient, venueId, weekStart);
    },
    onError: (error) => {
      if (hasErrorCode(error, apiErrorCode.rota_already_published)) {
        setOpen(false);
        markRotaPublished(queryClient, venueId, weekStart);
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });

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
            {result.emails.length > 0 && (
              <ul aria-label={t('rota.publish.emailsLabel')} className="flex flex-col gap-2 text-sm">
                {result.emails.map(({ staffMemberId, name, status }) => (
                  <li key={staffMemberId} className="flex items-center justify-between gap-2">
                    <span>{name}</span>
                    <Badge variant={status === emailStatusSchema.enum.sent ? 'secondary' : 'destructive'}>
                      {t(`rota.publish.emailStatus.${status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {result.emails.some(({ status }) => status === emailStatusSchema.enum.failed) && (
              <Alert variant="destructive">
                <AlertDescription>{t('rota.publish.someFailed')}</AlertDescription>
              </Alert>
            )}
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
