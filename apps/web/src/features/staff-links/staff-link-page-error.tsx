import { apiErrorCode } from '@rota-ready/shared';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { hasErrorCode } from '@/lib/api';

export function StaffLinkPageError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();

  if (hasErrorCode(error, apiErrorCode.not_found)) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-2 p-6">
        <h1 className="text-xl font-semibold">{t('staffLink.page.invalidTitle')}</h1>
        <p className="text-muted-foreground">{t('staffLink.page.invalidDescription')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-4 p-6">
      <p role="alert">{apiErrorMessage(t, error)}</p>
      <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
        {t('staffLink.page.tryAgain')}
      </Button>
    </main>
  );
}
