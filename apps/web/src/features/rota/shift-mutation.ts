import {
  apiErrorCode,
  validationMessage,
  type Shift,
  type shiftFormSchema,
  type ShiftRequest,
} from '@rota-ready/shared';
import { useMutation } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { hasErrorCode } from '@/lib/api';

type ShiftForm = UseFormReturn<z.input<ReturnType<typeof shiftFormSchema>>, unknown, ShiftRequest>;

interface UseShiftMutationOptions {
  form: ShiftForm;
  send: (request: ShiftRequest) => Promise<Shift>;
  onSuccess: (shift: Shift) => void;
}

export function useShiftMutation({ form, send, onSuccess }: UseShiftMutationOptions) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: send,
    onSuccess,
    onError: (error) => {
      if (hasErrorCode(error, apiErrorCode.shift_overlaps)) {
        form.setError('root', { message: validationMessage.shiftOverlaps });
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });
}
