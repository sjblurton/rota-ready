import {
  formatLocalDate,
  shiftFormSchema,
  shiftFormValues,
  shiftSchema,
  validationMessage,
  type Shift,
  type ShiftRequest,
  type StaffMember,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { replaceShiftInRota, shiftPath } from '@/features/rota/rota-queries';
import { ShiftFields } from '@/features/rota/shift-fields';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch, hasErrorCode } from '@/lib/api';

interface EditShiftDialogProps {
  venueId: string;
  timeZone: string;
  weekStart: string;
  staffMembers: StaffMember[];
  shifts: Shift[];
  shift: Shift;
  times: string;
  staffMember: StaffMember;
}

export function EditShiftDialog({ times, staffMember, ...formProps }: EditShiftDialogProps) {
  const { timeZone, shift } = formProps;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const summary = {
    name: staffMember.name,
    day: formatLocalDate(shiftFormValues(shift, timeZone).date),
    times,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-1 py-0.5 font-normal"
          aria-label={t('rota.editShift.label', summary)}
        >
          {times}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rota.editShift.title')}</DialogTitle>
          <DialogDescription>{t('rota.editShift.description', summary)}</DialogDescription>
        </DialogHeader>
        <EditShiftForm {...formProps} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditShiftForm({
  venueId,
  timeZone,
  weekStart,
  staffMembers,
  shifts,
  shift,
  onDone,
}: Omit<EditShiftDialogProps, 'times' | 'staffMember'> & { onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const otherShifts = shifts.filter((other) => other.id !== shift.id);
  const form = useForm({
    resolver: zodResolver(shiftFormSchema(timeZone, otherShifts)),
    defaultValues: shiftFormValues(shift, timeZone),
  });
  const edit = useMutation({
    mutationFn: (request: ShiftRequest) =>
      apiPatch(shiftPath(venueId, weekStart, shift.id), request, shiftSchema),
    onSuccess: (updated) => {
      replaceShiftInRota(queryClient, venueId, weekStart, updated);
      onDone();
    },
    onError: (error) => {
      if (hasErrorCode(error, 'shift_overlaps')) {
        form.setError('root', { message: validationMessage.shiftOverlaps });
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });

  function onSubmit(request: ShiftRequest) {
    edit.mutate(request);
  }

  return (
    <FormProvider {...form}>
      <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <ShiftFields weekStart={weekStart} staffMembers={staffMembers} />
          <FieldError errors={[form.formState.errors.root]} />
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('rota.editShift.cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={edit.isPending}>
            {t('rota.editShift.submit')}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
