import { healthResponseSchema, type HealthResponse } from '@rota-ready/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { VariantProps } from 'class-variance-authority';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const healthStatus = {
  checking: { labelKey: 'health.checking', variant: 'secondary' },
  unreachable: { labelKey: 'health.unreachable', variant: 'destructive' },
  dbDown: { labelKey: 'health.dbDown', variant: 'destructive' },
  ok: { labelKey: 'health.ok', variant: 'default' },
} as const satisfies Record<string, { labelKey: ParseKeys; variant: BadgeVariant }>;

function statusOf(health: UseQueryResult<HealthResponse>) {
  if (health.isPending) return healthStatus.checking;
  if (health.isError) return healthStatus.unreachable;
  return health.data.db === 'ok' ? healthStatus.ok : healthStatus.dbDown;
}

export function HealthStatus() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/health', healthResponseSchema),
    refetchInterval: 5_000,
    retry: false,
  });

  const status = statusOf(health);

  return (
    <Badge role="status" variant={status.variant}>
      {t(status.labelKey)}
    </Badge>
  );
}
