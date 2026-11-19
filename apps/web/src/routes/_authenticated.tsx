import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HealthStatus } from '@/components/health-status';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { bootstrapCurrentUserQuery } from '@/features/users/current-user';
import { accessToken, supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  // Child routes call user-scoped endpoints, which 403 until this bootstrap has stored the User.
  beforeLoad: async ({ context }) => {
    if (!(await accessToken())) throw redirect({ to: '/login' });
    try {
      const currentUser = await context.queryClient.query(bootstrapCurrentUserQuery);
      return { currentUser };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await endSession(context.queryClient);
        throw redirect({ to: '/login' });
      }
      throw error;
    }
  },
  component: AuthenticatedLayout,
});

async function endSession(queryClient: QueryClient) {
  await supabase.auth.signOut();
  queryClient.clear();
}

function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { currentUser } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logOut() {
    await endSession(queryClient);
    await navigate({ to: '/login' });
  }

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-6 py-3">
          <span className="font-medium">{t('app.name')}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{currentUser.email}</span>
            <Button variant="outline" size="sm" onClick={logOut}>
              {t('auth.logOut')}
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="mx-auto flex max-w-xl px-6 pb-6">
        <HealthStatus />
      </footer>
    </>
  );
}
