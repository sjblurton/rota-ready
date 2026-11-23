import { useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { AppHeader } from '@/components/app-header';
import { HealthStatus } from '@/components/health-status';
import { PageLoadError } from '@/components/page-load-error';
import { bootstrapCurrentUserQuery } from '@/features/users/current-user';
import { accessToken, supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    if (!(await accessToken())) throw redirect({ to: '/login' });
    const currentUser = await context.queryClient.query(bootstrapCurrentUserQuery);
    return { currentUser };
  },
  errorComponent: AuthenticatedLoadError,
  component: AuthenticatedLayout,
});

function AuthenticatedLoadError({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto max-w-xl p-6 sm:p-10">
      <PageLoadError error={error} />
    </main>
  );
}

function AuthenticatedLayout() {
  const { currentUser } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logOut() {
    await supabase.auth.signOut();
    await navigate({ to: '/login' });
    queryClient.clear();
  }

  return (
    <>
      <AppHeader email={currentUser.email} onLogOut={logOut} />
      <Outlet />
      <footer className="mx-auto flex max-w-app px-6 pb-6 sm:px-10">
        <HealthStatus />
      </footer>
    </>
  );
}
