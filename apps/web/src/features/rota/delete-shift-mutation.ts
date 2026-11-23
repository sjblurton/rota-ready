import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { refetchRota, removeShiftFromRota, shiftPath } from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiDelete } from '@/lib/api';

export function useDeleteShift(venueId: string, weekStart: string, shiftId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(shiftPath(venueId, weekStart, shiftId), z.undefined()),
    onSuccess: () => {
      removeShiftFromRota(queryClient, venueId, weekStart, shiftId);
      refetchRota(queryClient, venueId, weekStart);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}
