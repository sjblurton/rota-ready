import { SparklesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProPlanCard } from '@/features/plans/pro-plan-card';

export function UpgradeToProDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" aria-label={t('plans.upgrade.button')}>
          <SparklesIcon aria-hidden data-icon="inline-start" />
          <span className="sm:hidden">{t('plans.upgrade.buttonShort')}</span>
          <span className="hidden sm:inline">{t('plans.upgrade.button')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('plans.upgrade.title')}</DialogTitle>
          <DialogDescription>{t('plans.upgrade.description')}</DialogDescription>
        </DialogHeader>
        <ProPlanCard />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('plans.upgrade.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
