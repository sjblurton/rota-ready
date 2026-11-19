import { credentialsSchema, type Credentials } from '@rota-ready/shared';
import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  authenticate: (credentials: Credentials) => Promise<string | null>;
  footer: ReactNode;
}

export function AuthForm({
  title,
  submitLabel,
  passwordAutoComplete,
  authenticate,
  footer,
}: AuthFormProps) {
  const { t } = useTranslation();
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
            <h1>{title}</h1>
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
                  autoComplete={passwordAutoComplete}
                  aria-invalid={!!errors.password}
                  aria-describedby="password-error"
                  {...form.register('password')}
                />
                <FieldError id="password-error" errors={[errors.password]} />
              </Field>
              <FieldError>{errors.root?.message}</FieldError>
            </FieldGroup>
            <Button type="submit" disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      </Card>
    </main>
  );
}
