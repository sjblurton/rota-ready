import { weekStartOf } from '@rota-ready/shared';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { venueQuery } from '@/features/venues/venue-queries';

export const Route = createFileRoute('/_authenticated/venues/$venueId/rota/')({
  beforeLoad: async ({ context, params }) => {
    const venue = await context.queryClient.query(venueQuery(params.venueId));
    throw redirect({
      to: '/venues/$venueId/rota/$weekStart',
      params: { venueId: params.venueId, weekStart: weekStartOf(new Date(), venue.timeZone) },
    });
  },
});
