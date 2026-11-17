import { healthResponseSchema } from '@rota-ready/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
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

function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/health', healthResponseSchema),
    refetchInterval: 5_000,
    retry: false,
  });

  const status = health.isPending
    ? { label: 'Checking API…', variant: 'secondary' as const }
    : health.isError
      ? { label: 'API unreachable', variant: 'destructive' as const }
      : { label: 'API ok', variant: 'default' as const };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Rota Ready</CardTitle>
          <CardDescription>
            Weekly staff rotas for UK pubs, bars and restaurants.
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
