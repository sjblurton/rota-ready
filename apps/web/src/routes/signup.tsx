import type { Credentials } from '@rota-ready/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthForm } from '@/features/users/auth-form';
import { authErrorMessage } from '@/features/users/auth-error-message';
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
    if (error) return authErrorMessage(t, error.code);
    if (data.session) await navigate({ to: '/' });
    else setAwaitingConfirmation(true);
    return null;
  }

  if (awaitingConfirmation) {
    return (
      <main className="mx-auto max-w-sm p-6 sm:pt-16">
        <p role="status">{t('auth.signUp.checkEmail')}</p>
      </main>
    );
  }

  return (
    <AuthForm mode="signUp" authenticate={signUp} />
  );
}
