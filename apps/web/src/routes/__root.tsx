import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <div className="min-h-svh bg-background text-foreground">
      <Outlet />
      <Toaster />
    </div>
  ),
});
