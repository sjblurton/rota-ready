import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  email: string;
  onLogOut: () => void;
}

export function AppHeader({ email, onLogOut }: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-app items-center justify-between gap-4 px-6 py-3 sm:px-10">
        <span className="font-medium">{t('app.name')}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{email}</span>
          <Button variant="outline" size="sm" onClick={onLogOut}>
            {t('auth.logOut')}
          </Button>
        </div>
      </div>
    </header>
  );
}
