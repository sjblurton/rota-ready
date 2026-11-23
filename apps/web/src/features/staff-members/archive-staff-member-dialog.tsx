import type { StaffMember } from '@rota-ready/shared';
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
import { useArchiveStaffMember } from '@/features/staff-members/staff-member-mutations';

interface ArchiveStaffMemberDialogProps {
  venueId: string;
  staffMember: StaffMember;
}

export function ArchiveStaffMemberDialog({ venueId, staffMember }: ArchiveStaffMemberDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const archive = useArchiveStaffMember(venueId, staffMember.id, {
    onSuccess: () => setOpen(false),
  });

  function confirm(event: MouseEvent) {
    event.preventDefault();
    archive.mutate();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          aria-label={t('staff.archive.label', { name: staffMember.name })}
        >
          {t('staff.archive.button')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('staff.archive.title', { name: staffMember.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('staff.archive.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('staff.archive.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={archive.isPending} onClick={confirm}>
            {t('staff.archive.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
