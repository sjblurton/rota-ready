import type { ShiftResponse } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { shownResponse, type ShownResponse } from '@/features/staff-links/shown-response';

const variants = {
  pending: 'outline',
  confirmed: 'default',
  declined: 'destructive',
  noReply: 'secondary',
} as const satisfies Record<ShownResponse, string>;

interface ShiftResponseBadgeProps {
  response: ShiftResponse;
  started: boolean;
}

export function ShiftResponseBadge({ response, started }: ShiftResponseBadgeProps) {
  const { t } = useTranslation();
  const shown = shownResponse(response, started);
  return <Badge variant={variants[shown]}>{t(`shiftResponse.${shown}`)}</Badge>;
}

interface ShiftResponseWithReasonProps extends ShiftResponseBadgeProps {
  declineReason: string | null;
}

export function ShiftResponseWithReason({
  response,
  started,
  declineReason,
}: ShiftResponseWithReasonProps) {
  const { t } = useTranslation();
  if (!declineReason) return <ShiftResponseBadge response={response} started={started} />;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0"
          aria-label={t('shiftResponse.showReason', { response: t(`shiftResponse.${response}`) })}
        >
          <ShiftResponseBadge response={response} started={started} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-72">{declineReason}</PopoverContent>
    </Popover>
  );
}
