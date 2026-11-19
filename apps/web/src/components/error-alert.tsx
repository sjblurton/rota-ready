import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
