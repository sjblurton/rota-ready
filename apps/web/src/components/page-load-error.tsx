import { apiErrorCode } from '@rota-ready/shared';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { hasErrorCode } from '@/lib/api';

type PageLoadErrorProps = {
  error: unknown;
  otherWayForward?: ReactNode;
};

export function PageLoadError({ error, otherWayForward }: PageLoadErrorProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const retryCanHelp = !hasErrorCode(error, apiErrorCode.not_found);

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive">
        <AlertDescription>{apiErrorMessage(t, error)}</AlertDescription>
      </Alert>
      {(retryCanHelp || otherWayForward) && (
        <div className="flex flex-wrap gap-2">
          {retryCanHelp && (
            <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
              {t('pageLoadError.tryAgain')}
            </Button>
          )}
          {otherWayForward}
        </div>
      )}
    </div>
  );
}
