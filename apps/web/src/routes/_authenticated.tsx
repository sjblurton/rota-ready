import { useQueryClient, type QueryClient } from '@tanstack/react-query';
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
import { ApiError } from '@/lib/api';
import { bootstrapCurrentUserQuery } from '@/features/users/current-user';
import { accessToken, supabase } from '@/lib/supabase';

export const Route = createFileRoute('/_authenticated')({
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

async function endSession(queryClient: QueryClient) {
  await supabase.auth.signOut();
  queryClient.clear();
}

function AuthenticatedLayout() {
  const { currentUser } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function logOut() {
    await endSession(queryClient);
    await navigate({ to: '/login' });
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
