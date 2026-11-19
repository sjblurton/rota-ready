import { credentialsSchema, type Credentials } from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface AuthFormProps {
  mode: 'logIn' | 'signUp';
  authenticate: (credentials: Credentials) => Promise<string | null>;
}

export function AuthForm({ mode, authenticate }: AuthFormProps) {
  const { t } = useTranslation();
  const copy = {
    logIn: {
      title: t('auth.logIn.title'),
      submit: t('auth.logIn.submit'),
      passwordAutoComplete: 'current-password',
      switchPrompt: t('auth.logIn.noAccount'),
      switchLink: t('auth.logIn.signUpLink'),
      switchTo: '/signup',
    },
    signUp: {
      title: t('auth.signUp.title'),
      submit: t('auth.signUp.submit'),
      passwordAutoComplete: 'new-password',
      switchPrompt: t('auth.signUp.haveAccount'),
      switchLink: t('auth.signUp.logInLink'),
      switchTo: '/login',
    },
  }[mode];
  const form = useForm({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(credentials: Credentials) {
    const message = await authenticate(credentials);
    if (message) form.setError('root', { message });
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col p-6 sm:pt-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{copy.title}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={!!errors.email}
                  aria-describedby="email-error"
                  {...form.register('email')}
                />
                <FieldError id="email-error" errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">{t('auth.password')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={copy.passwordAutoComplete}
                  aria-invalid={!!errors.password}
                  aria-describedby="password-error"
                  {...form.register('password')}
                />
                <FieldError id="password-error" errors={[errors.password]} />
              </Field>
              <FieldError>{errors.root?.message}</FieldError>
            </FieldGroup>
            <Button type="submit" disabled={isSubmitting}>
              {copy.submit}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
          {copy.switchPrompt}
          <Link to={copy.switchTo} className="text-foreground underline underline-offset-4">
            {copy.switchLink}
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
