import type { Credentials } from '@rota-ready/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthForm } from '@/features/users/auth-form';
import { formMessageOrToast } from '@/features/users/auth-error-message';
import { redirectIfLoggedIn } from '@/features/users/redirect-if-logged-in';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/login')({
  beforeLoad: redirectIfLoggedIn,
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function logIn(credentials: Credentials) {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) return formMessageOrToast(t, error.code);
    await navigate({ to: '/' });
    return null;
  }

  return (
    <AuthForm mode="logIn" authenticate={logIn} />
  );
}
