import { apiErrorCode, publishResultSchema, sendUpdatesResultSchema } from '@rota-ready/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  markRotaPublished,
  publishPath,
  refetchRota,
  sendUpdatesPath,
} from '@/features/rota/rota-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPost, hasErrorCode } from '@/lib/api';

interface UsePublishRotaOptions {
  onAlreadyPublished: () => void;
}

export function usePublishRota(
  venueId: string,
  weekStart: string,
  { onAlreadyPublished }: UsePublishRotaOptions,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(publishPath(venueId, weekStart), undefined, publishResultSchema),
    onSuccess: () => {
      markRotaPublished(queryClient, venueId, weekStart);
    },
    onError: (error) => {
      if (hasErrorCode(error, apiErrorCode.rota_already_published)) {
        markRotaPublished(queryClient, venueId, weekStart);
        onAlreadyPublished();
      } else {
        toast.error(apiErrorMessage(t, error));
      }
    },
  });
}

export function useSendUpdates(venueId: string, weekStart: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(sendUpdatesPath(venueId, weekStart), undefined, sendUpdatesResultSchema),
    onSuccess: () => {
      refetchRota(queryClient, venueId, weekStart);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(t, error));
    },
  });
}
