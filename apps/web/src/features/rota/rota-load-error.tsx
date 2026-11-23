import { Link, useParams, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageLoadError } from '@/components/page-load-error';
import { Button } from '@/components/ui/button';

export function RotaLoadError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const { venueId } = useParams({ from: '/_authenticated/venues/$venueId' });
  return (
    <PageLoadError
      error={error}
      otherWayForward={
        <Button variant="outline" size="sm" asChild>
          <Link to="/venues/$venueId/rota" params={{ venueId }}>
            {t('rota.goToThisWeek')}
          </Link>
        </Button>
      }
    />
  );
}
