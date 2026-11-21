import { formatLocalDate } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { markRotaPublished, publishPath } from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, hasErrorCode } from '@/lib/api';

interface PublishRotaDialogProps {
  venueId: string;
  weekStart: string;
}

export function PublishRotaDialog({ venueId, weekStart }: PublishRotaDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  function showPublished() {
    setOpen(false);
    markRotaPublished(queryClient, venueId, weekStart);
  }
  const publish = useMutation({
    mutationFn: () => apiPost(publishPath(venueId, weekStart), undefined, z.undefined()),
    onSuccess: showPublished,
    onError: (error) => {
      if (hasErrorCode(error, 'rota_already_published')) {
        showPublished();
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });

  function confirm(event: MouseEvent) {
    event.preventDefault();
    publish.mutate();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">{t('rota.publish.button')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('rota.publish.title', { date: formatLocalDate(weekStart, { withYear: true }) })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('rota.publish.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('rota.publish.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={publish.isPending} onClick={confirm}>
            {t('rota.publish.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
