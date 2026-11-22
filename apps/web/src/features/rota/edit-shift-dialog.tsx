import {
  formatLocalDate,
  shiftFormSchema,
  shiftFormValues,
  shiftSchema,
  type Shift,
  type ShiftRequest,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { DeleteShiftDialog, type ShiftSummary } from '@/features/rota/delete-shift-dialog';
import {
  refetchRota,
  replaceShiftInRota,
  shiftPath,
  useRotaWeek,
} from '@/features/rota/rota-queries';
import { ShiftFields } from '@/features/rota/shift-fields';
import { useShiftMutation } from '@/features/rota/shift-mutation';
import { apiPatch } from '@/lib/api';

interface EditShiftDialogProps {
  venueId: string;
  weekStart: string;
  shift: Shift;
  times: string;
}

export function EditShiftDialog({ venueId, weekStart, shift, times }: EditShiftDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { staffMembers, timeZone } = useRotaWeek(venueId, weekStart);
  const summary: ShiftSummary = {
    name: staffMembers.find((staffMember) => staffMember.id === shift.staffMemberId)?.name,
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
        <EditShiftForm
          venueId={venueId}
          weekStart={weekStart}
          shift={shift}
          summary={summary}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditShiftForm({
  venueId,
  weekStart,
  shift,
  summary,
  onDone,
}: Omit<EditShiftDialogProps, 'times'> & {
  summary: ShiftSummary;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { shifts, staffMembers, timeZone } = useRotaWeek(venueId, weekStart);
  const queryClient = useQueryClient();
  const otherShifts = shifts.filter((other) => other.id !== shift.id);
  const form = useForm({
    resolver: zodResolver(shiftFormSchema(timeZone, otherShifts)),
    defaultValues: shiftFormValues(shift, timeZone),
  });
  const edit = useShiftMutation({
    form,
    send: (request) => apiPatch(shiftPath(venueId, weekStart, shift.id), request, shiftSchema),
    onSuccess: (updated) => {
      replaceShiftInRota(queryClient, venueId, weekStart, updated);
      refetchRota(queryClient, venueId, weekStart);
      onDone();
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
          <DeleteShiftDialog
            venueId={venueId}
            weekStart={weekStart}
            shiftId={shift.id}
            summary={summary}
          />
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
