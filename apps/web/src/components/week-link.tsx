import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

interface WeekLinkProps {
  venueId: string;
  weekStart: string;
  children: string;
}

export function WeekLink({ venueId, weekStart, children }: WeekLinkProps) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/venues/$venueId/rota/$weekStart" params={{ venueId, weekStart }}>
        {children}
      </Link>
    </Button>
  );
}
