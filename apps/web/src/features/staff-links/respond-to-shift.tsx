import {
  declineFormSchema,
  staffLinkShiftSchema,
  type ShiftResponseRequest,
  type StaffLinkShift,
} from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { replaceStaffLinkShift, shiftResponsePath } from '@/features/staff-links/staff-link-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPut, hasErrorCode } from '@/lib/api';

interface RespondToShiftProps {
  token: string;
  shift: StaffLinkShift;
  day: string;
  times: string;
}

function useRespondToShift(token: string, shift: StaffLinkShift, onDone?: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ShiftResponseRequest) =>
      apiPut(shiftResponsePath(token, shift.id), request, staffLinkShiftSchema),
    onSuccess: (updated) => {
      replaceStaffLinkShift(queryClient, token, updated);
      onDone?.();
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
      if (hasErrorCode(error, 'shift_started')) {
        replaceStaffLinkShift(queryClient, token, { ...shift, canRespond: false });
        onDone?.();
      }
    },
  });
}

export function RespondToShift({ token, shift, day, times }: RespondToShiftProps) {
  const { t } = useTranslation();
  const confirm = useRespondToShift(token, shift);

  if (!shift.canRespond) {
    return <p className="text-sm text-muted-foreground">{t('staffLink.page.started')}</p>;
  }

  return (
    <div className="flex gap-2">
      {shift.response !== 'confirmed' && (
        <Button
          size="sm"
          disabled={confirm.isPending}
          aria-label={t('staffLink.page.confirmLabel', { day })}
          onClick={() => confirm.mutate({ response: 'confirmed' })}
        >
          {t('staffLink.page.confirm')}
        </Button>
      )}
      <DeclineShiftDialog token={token} shift={shift} day={day} times={times} />
    </div>
  );
}

function DeclineShiftDialog({ token, shift, day, times }: RespondToShiftProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('staffLink.page.declineLabel', { day })}>
          {t('staffLink.page.decline')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('staffLink.page.declineTitle', { day })}</DialogTitle>
          <DialogDescription>{t('staffLink.page.declineDescription', { times })}</DialogDescription>
        </DialogHeader>
        <DeclineShiftForm token={token} shift={shift} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface DeclineShiftFormProps {
  token: string;
  shift: StaffLinkShift;
  onDone: () => void;
}

function DeclineShiftForm({ token, shift, onDone }: DeclineShiftFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(declineFormSchema),
    defaultValues: { declineReason: shift.declineReason ?? '' },
  });
  const { errors } = form.formState;
  const decline = useRespondToShift(token, shift, onDone);

  function onSubmit({ declineReason }: z.output<typeof declineFormSchema>) {
    decline.mutate({ response: 'declined', declineReason });
  }

  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={!!errors.declineReason}>
          <FieldLabel htmlFor={`${id}-reason`}>{t('staffLink.page.declineReason')}</FieldLabel>
          <Input
            id={`${id}-reason`}
            aria-invalid={!!errors.declineReason}
            aria-describedby={`${id}-reason-error`}
            {...form.register('declineReason')}
          />
          <FieldError id={`${id}-reason-error`} errors={[errors.declineReason]} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t('staffLink.page.declineCancel')}
          </Button>
        </DialogClose>
        <Button type="submit" variant="destructive" disabled={decline.isPending}>
          {t('staffLink.page.declineSubmit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
