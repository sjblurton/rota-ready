import { healthResponseSchema, type HealthResponse } from '@rota-ready/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { VariantProps } from 'class-variance-authority';
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
  checking: { label: 'Checking API…', variant: 'secondary' },
  unreachable: { label: 'API unreachable', variant: 'destructive' },
  dbDown: { label: 'API ok · DB down', variant: 'destructive' },
  ok: { label: 'API ok · DB ok', variant: 'default' },
} as const satisfies Record<string, { label: string; variant: BadgeVariant }>;

function statusOf(health: UseQueryResult<HealthResponse>) {
  if (health.isPending) return healthStatus.checking;
  if (health.isError) return healthStatus.unreachable;
  return health.data.db === 'ok' ? healthStatus.ok : healthStatus.dbDown;
}

function HomePage() {
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
          <CardTitle className="text-2xl">Rota Ready</CardTitle>
          <CardDescription>
            Weekly staff rotas for UK bars and restaurants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge role="status" variant={status.variant}>
            {status.label}
          </Badge>
        </CardContent>
      </Card>
    </main>
  );
}
