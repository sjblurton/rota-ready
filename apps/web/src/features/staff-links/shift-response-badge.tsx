import type { ShiftResponse } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const variants = {
  pending: 'outline',
  confirmed: 'default',
  declined: 'destructive',
} as const satisfies Record<ShiftResponse, string>;

export function ShiftResponseBadge({ response }: { response: ShiftResponse }) {
  const { t } = useTranslation();
  return <Badge variant={variants[response]}>{t(`shiftResponse.${response}`)}</Badge>;
}

interface ShiftResponseWithReasonProps {
  response: ShiftResponse;
  declineReason: string | null;
}

export function ShiftResponseWithReason({ response, declineReason }: ShiftResponseWithReasonProps) {
  const { t } = useTranslation();
  if (!declineReason) return <ShiftResponseBadge response={response} />;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0"
          aria-label={t('shiftResponse.showReason', { response: t(`shiftResponse.${response}`) })}
        >
          <ShiftResponseBadge response={response} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-72">{declineReason}</PopoverContent>
    </Popover>
  );
}
