import { createFileRoute, redirect } from '@tanstack/react-router';
import { LandingPage } from '@/features/plans/landing-page';
import { accessToken } from '@/lib/supabase';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (await accessToken()) throw redirect({ to: '/onboarding' });
  },
  component: LandingPage,
});
