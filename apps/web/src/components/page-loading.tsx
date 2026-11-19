import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SLOW_AFTER_MS = 5_000;

export function PageLoading() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-live="polite"
      className="mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center gap-3 p-10 text-center"
    >
      <LoaderCircleIcon aria-hidden className="size-6 animate-spin text-muted-foreground" />
      <p className="font-medium">{t('loading.title')}</p>
      {slow && <p className="text-sm text-muted-foreground">{t('loading.slow')}</p>}
    </div>
  );
}
