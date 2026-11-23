import { apiErrorCode } from '@rota-ready/shared';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageLoadError } from '@/components/page-load-error';
import { hasErrorCode } from '@/lib/api';

export function StaffLinkPageError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();

  if (hasErrorCode(error, apiErrorCode.not_found)) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-2 p-6">
        <h1 className="text-xl font-semibold">{t('staffLink.page.invalidTitle')}</h1>
        <p className="text-muted-foreground">{t('staffLink.page.invalidDescription')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <PageLoadError error={error} />
    </main>
  );
}
