import { firstNameOf, type StaffMember } from '@rota-ready/shared';
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
import { useRegenerateStaffLink } from '@/features/staff-links/staff-link-mutations';

interface RegenerateStaffLinkDialogProps {
  venueId: string;
  staffMember: StaffMember;
}

export function RegenerateStaffLinkDialog({ venueId, staffMember }: RegenerateStaffLinkDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const firstName = firstNameOf(staffMember.name);
  const regenerate = useRegenerateStaffLink(venueId, staffMember.id, {
    onSuccess: () => setOpen(false),
  });

  function confirm(event: MouseEvent) {
    event.preventDefault();
    regenerate.mutate();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{t('staffLink.regenerate.button')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('staffLink.regenerate.title', { firstName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('staffLink.regenerate.description', { firstName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('staffLink.regenerate.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={regenerate.isPending}
            onClick={confirm}
          >
            {t('staffLink.regenerate.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
