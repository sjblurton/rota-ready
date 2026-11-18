import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface Credentials {
  email: string;
  password: string;
}

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get('email')),
      password: String(form.get('password')),
    };
    startTransition(async () => {
      const message = await onSubmit(credentials);
      startTransition(() => setError(message));
    });
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
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={passwordAutoComplete}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isPending}>
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
