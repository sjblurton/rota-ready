import { healthResponseSchema, type HealthResponse } from '@rota-ready/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { VariantProps } from 'class-variance-authority';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiGet } from '@/lib/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const healthStatus = {
  checking: { label: 'health.checking', variant: 'secondary' },
  unreachable: { label: 'health.unreachable', variant: 'destructive' },
  dbDown: { label: 'health.dbDown', variant: 'destructive' },
  ok: { label: 'health.ok', variant: 'default' },
} as const satisfies Record<string, { label: ParseKeys; variant: BadgeVariant }>;

function statusOf(health: UseQueryResult<HealthResponse>) {
  if (health.isPending) return healthStatus.checking;
  if (health.isError) return healthStatus.unreachable;
  return health.data.db === 'ok' ? healthStatus.ok : healthStatus.dbDown;
}

function HomePage() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/health', healthResponseSchema),
    refetchInterval: 5_000,
    retry: false,
  });

  const status = statusOf(health);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('app.name')}</CardTitle>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge role="status" variant={status.variant}>
            {t(status.label)}
          </Badge>
        </CardContent>
      </Card>
    </main>
  );
}
