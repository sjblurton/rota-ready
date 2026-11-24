import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { UpgradeToProDialog } from '@/features/plans/upgrade-to-pro-dialog';

interface AppHeaderProps {
  email: string;
  onLogOut: () => void;
}

export function AppHeader({ email, onLogOut }: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-app items-center justify-between gap-4 px-6 py-3 sm:px-10">
        <span className="shrink-0 font-medium">{t('app.name')}</span>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="truncate text-sm text-muted-foreground">{email}</span>
          <UpgradeToProDialog />
          <Button variant="outline" size="sm" onClick={onLogOut}>
            {t('auth.logOut')}
          </Button>
        </div>
      </div>
    </header>
  );
}
