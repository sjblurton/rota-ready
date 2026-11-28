import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';

export type PrototypeVariant = { key: string; name: string };

export function usePrototypeVariant(variants: PrototypeVariant[]) {
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const key = typeof search.variant === 'string' ? search.variant : variants[0]!.key;
  return variants.find((v) => v.key === key) ?? variants[0]!;
}

export function PrototypeSwitcher({ variants }: { variants: PrototypeVariant[] }) {
  const current = usePrototypeVariant(variants);
  const navigate = useNavigate();
  const index = variants.indexOf(current);

  function go(step: number) {
    const next = variants[(index + step + variants.length) % variants.length]!;
    void navigate({ to: '.', search: { variant: next.key } as never, replace: true });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 px-2 py-1 text-sm text-white shadow-lg ring-2 ring-white">
      <button type="button" aria-label="Previous variant" className="rounded-full p-1 hover:bg-white/20" onClick={() => go(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 font-medium">
        PROTOTYPE {current.key} ({current.name})
      </span>
      <button type="button" aria-label="Next variant" className="rounded-full p-1 hover:bg-white/20" onClick={() => go(1)}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
