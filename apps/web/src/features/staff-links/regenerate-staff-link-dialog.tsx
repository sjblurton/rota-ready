import { firstNameOf, staffLinkSchema, type StaffMember } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { setStaffLink, staffLinkPath } from '@/features/staff-links/staff-link-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';

interface RegenerateStaffLinkDialogProps {
  venueId: string;
  staffMember: StaffMember;
}

export function RegenerateStaffLinkDialog({ venueId, staffMember }: RegenerateStaffLinkDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const firstName = firstNameOf(staffMember.name);
  const regenerate = useMutation({
    mutationFn: () =>
      apiPost(`${staffLinkPath(venueId, staffMember.id)}/regenerate`, undefined, staffLinkSchema),
    onSuccess: (staffLink) => {
      setOpen(false);
      setStaffLink(queryClient, venueId, staffMember.id, staffLink);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
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
