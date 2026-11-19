import { Link, useParams, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/i18n/api-error-message';

export function RotaLoadError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const { venueId } = useParams({ from: '/_authenticated/venues/$venueId' });
  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive">
        <AlertDescription>{apiErrorMessage(t, error)}</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" asChild>
        <Link to="/venues/$venueId/rota" params={{ venueId }}>
          {t('rota.goToThisWeek')}
        </Link>
      </Button>
    </div>
  );
}
