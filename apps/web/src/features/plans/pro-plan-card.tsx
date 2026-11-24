import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanFeatureList } from '@/features/plans/plan-feature-list';

export function ProPlanCard() {
  const { t } = useTranslation();
  const features = [
    t('plans.pro.notifications'),
    t('plans.pro.reminders'),
    t('plans.pro.staff'),
    t('plans.pro.texts'),
    t('plans.pro.venues'),
    t('plans.pro.managers'),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl">{t('plans.pro.name')}</h3>
          <Badge variant="secondary">{t('plans.pro.comingSoon')}</Badge>
        </CardTitle>
        <CardDescription>{t('plans.pro.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <PlanFeatureList features={features} />
      </CardContent>
    </Card>
  );
}
