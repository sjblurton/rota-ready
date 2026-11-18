import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { currentUserQuery } from '@/lib/current-user';
import { accessToken, supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    if (!(await accessToken())) throw redirect({ to: '/login' });
  },
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(currentUserQuery);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await supabase.auth.signOut();
        throw redirect({ to: '/login' });
      }
      throw error;
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { t } = useTranslation();
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-6 py-3">
          <span className="font-medium">{t('app.name')}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={logOut}>
              {t('auth.logOut')}
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </>
  );
}
