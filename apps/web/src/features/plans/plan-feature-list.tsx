import { CheckIcon } from 'lucide-react';

export function PlanFeatureList({ features }: { features: string[] }) {
  return (
    <ul role="list" className="flex flex-col gap-3 text-sm">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
