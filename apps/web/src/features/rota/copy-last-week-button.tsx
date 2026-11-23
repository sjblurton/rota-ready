import { rotaSchema } from '@rota-ready/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCopyLastWeek } from '@/features/rota/copy-last-week-mutation';
import { rotaQuery } from '@/features/rota/rota-queries';

interface CopyLastWeekButtonProps {
  venueId: string;
  weekStart: string;
}

export function CopyLastWeekButton({ venueId, weekStart }: CopyLastWeekButtonProps) {
  const { t } = useTranslation();
  const { data: rota } = useSuspenseQuery(rotaQuery(venueId, weekStart));
  const copyLastWeek = useCopyLastWeek(venueId, weekStart);

  if (rota.status !== rotaSchema.shape.status.enum.draft || rota.shifts.length > 0) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={copyLastWeek.isPending}
      onClick={() => copyLastWeek.mutate()}
    >
      {t('rota.copyLastWeek.button')}
    </Button>
  );
}
