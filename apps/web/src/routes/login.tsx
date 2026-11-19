import type { Credentials } from '@rota-ready/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthForm } from '@/components/auth-form';
import { authErrorMessage } from '@/i18n/auth-error-message';
import { redirectIfLoggedIn } from '@/lib/redirect-if-logged-in';
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
    if (error) return authErrorMessage(t, error.code);
    await navigate({ to: '/' });
    return null;
  }

  return (
    <AuthForm
      title={t('auth.logIn.title')}
      submitLabel={t('auth.logIn.submit')}
      passwordAutoComplete="current-password"
      authenticate={logIn}
      footer={
        <>
          {t('auth.logIn.noAccount')}
          <Link to="/signup" className="text-foreground underline underline-offset-4">
            {t('auth.logIn.signUpLink')}
          </Link>
        </>
      }
    />
  );
}
