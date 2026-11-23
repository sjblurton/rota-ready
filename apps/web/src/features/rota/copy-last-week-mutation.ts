import { copyLastWeekResultSchema } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { copyLastWeekPath, refetchRota, rotaQuery } from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost } from '@/lib/api';

export function useCopyLastWeek(venueId: string, weekStart: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(copyLastWeekPath(venueId, weekStart), undefined, copyLastWeekResultSchema),
    onSuccess: ({ rota, skippedShifts }) => {
      queryClient.setQueryData(rotaQuery(venueId, weekStart).queryKey, rota);
      if (skippedShifts > 0) toast(t('rota.copyLastWeek.skipped', { count: skippedShifts }));
      else if (rota.shifts.length === 0) toast(t('rota.copyLastWeek.nothingToCopy'));
    },
    onError: (error) => {
      refetchRota(queryClient, venueId, weekStart);
      toast.error(apiErrorMessage(t, error));
    },
  });
}
