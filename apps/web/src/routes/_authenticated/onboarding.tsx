import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreateVenueForm } from '@/features/venues/create-venue-form';
import { myVenuesQuery } from '@/features/venues/venue-queries';

export const Route = createFileRoute('/_authenticated/onboarding')({
  beforeLoad: async ({ context }) => {
    const [venue] = await context.queryClient.query(myVenuesQuery);
    if (venue) throw redirect({ to: '/venues/$venueId', params: { venueId: venue.id } });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex max-w-xl flex-col p-6 sm:p-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{t('onboarding.title')}</h1>
          </CardTitle>
          <CardDescription>{t('onboarding.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateVenueForm />
        </CardContent>
      </Card>
    </main>
  );
}
