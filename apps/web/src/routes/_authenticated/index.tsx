import { createFileRoute, redirect } from '@tanstack/react-router';
import { myVenuesQuery } from '@/features/venues/venue-queries';

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: async ({ context }) => {
    const [venue] = await context.queryClient.query(myVenuesQuery);
    if (!venue) throw redirect({ to: '/onboarding' });
    throw redirect({ to: '/venues/$venueId', params: { venueId: venue.id } });
  },
});
