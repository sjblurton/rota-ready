import type { Credentials } from '@rota-ready/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { AuthForm } from '@/features/users/auth-form';
import { formMessageOrToast } from '@/features/users/auth-error-message';
import { redirectIfLoggedIn } from '@/features/users/redirect-if-logged-in';
import { supabase } from '@/lib/supabase';

const loginSearchSchema = z.object({
  sessionEnded: z.literal(true).optional().catch(undefined),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: redirectIfLoggedIn,
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionEnded } = Route.useSearch();

  async function logIn(credentials: Credentials) {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) return formMessageOrToast(t, error.code);
    await navigate({ to: '/' });
    return null;
  }

  return (
    <AuthForm mode="logIn" authenticate={logIn} sessionEnded={sessionEnded === true} />
  );
}
