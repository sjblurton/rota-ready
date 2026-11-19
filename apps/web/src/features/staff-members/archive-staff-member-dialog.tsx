import type { StaffMember } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import { FieldError } from '@/components/ui/field';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';
import { staffMemberPath, updateStaffMembers } from '@/features/staff-members/staff-member-queries';

interface ArchiveStaffMemberDialogProps {
  venueId: string;
  staffMember: StaffMember;
}

export function ArchiveStaffMemberDialog({ venueId, staffMember }: ArchiveStaffMemberDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const archive = useMutation({
    mutationFn: () =>
      apiPost(`${staffMemberPath(venueId, staffMember.id)}/archive`, undefined, z.undefined()),
    onSuccess: () => {
      setOpen(false);
      updateStaffMembers(queryClient, venueId, (current) =>
        current.filter((existing) => existing.id !== staffMember.id),
      );
    },
  });

  function onOpenChange(nextOpen: boolean) {
    if (nextOpen) archive.reset();
    setOpen(nextOpen);
  }

  function confirm(event: MouseEvent) {
    event.preventDefault();
    archive.mutate();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
        <FieldError>{archive.isError && apiErrorMessage(t, archive.error)}</FieldError>
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
