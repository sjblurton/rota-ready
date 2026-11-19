import { credentialsSchema, type Credentials } from '@rota-ready/shared';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '@/components/error-alert';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { formResolver } from '@/lib/form-resolver';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  onSubmit: (credentials: Credentials) => Promise<string | null>;
  footer: ReactNode;
}

export function AuthForm({
  title,
  submitLabel,
  passwordAutoComplete,
  onSubmit,
  footer,
}: AuthFormProps) {
  const { t } = useTranslation();
  const form = useForm({
    resolver: formResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  async function submit(credentials: Credentials) {
    const message = await onSubmit(credentials);
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
          <form noValidate onSubmit={form.handleSubmit(submit)}>
            <FieldGroup>
              <TextField
                id="email"
                label={t('auth.email')}
                type="email"
                autoComplete="username"
                error={errors.email}
                schema={credentialsSchema.shape.email}
                {...form.register('email')}
              />
              <TextField
                id="password"
                label={t('auth.password')}
                type="password"
                autoComplete={passwordAutoComplete}
                error={errors.password}
                schema={credentialsSchema.shape.password}
                {...form.register('password')}
              />
              {errors.root && <ErrorAlert>{errors.root.message}</ErrorAlert>}
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      </Card>
    </main>
  );
}
