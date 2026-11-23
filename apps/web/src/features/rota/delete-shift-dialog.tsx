import type { MouseEvent } from 'react';
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
import { useDeleteShift } from '@/features/rota/delete-shift-mutation';

export type ShiftSummary = {
  name: string | undefined;
  day: string;
  times: string;
};

interface DeleteShiftDialogProps {
  venueId: string;
  weekStart: string;
  shiftId: string;
  summary: ShiftSummary;
}

export function DeleteShiftDialog({ venueId, weekStart, shiftId, summary }: DeleteShiftDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteShift(venueId, weekStart, shiftId);

  function confirm(event: MouseEvent) {
    event.preventDefault();
    remove.mutate();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" className="sm:mr-auto">
          {t('rota.deleteShift.button')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rota.deleteShift.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('rota.deleteShift.description', summary)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('rota.deleteShift.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {t('rota.deleteShift.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
