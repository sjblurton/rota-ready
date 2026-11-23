import type { Credentials } from '@rota-ready/shared';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthForm } from '@/features/users/auth-form';
import { formMessageOrToast } from '@/features/users/auth-error-message';
import { redirectIfLoggedIn } from '@/features/users/redirect-if-logged-in';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/signup')({
  beforeLoad: redirectIfLoggedIn,
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function signUp(credentials: Credentials) {
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) return formMessageOrToast(t, error.code);
    if (data.session) await navigate({ to: '/' });
    else setAwaitingConfirmation(true);
    return null;
  }

  if (awaitingConfirmation) {
    return (
      <main className="mx-auto flex max-w-sm flex-col items-center gap-2 p-6 sm:pt-16">
        <Alert role="status">
          <AlertDescription>{t('auth.signUp.checkEmail')}</AlertDescription>
        </Alert>
        <Button variant="link" asChild>
          <Link to="/login">{t('auth.signUp.logInLink')}</Link>
        </Button>
      </main>
    );
  }

  return (
    <AuthForm mode="signUp" authenticate={signUp} />
  );
}
