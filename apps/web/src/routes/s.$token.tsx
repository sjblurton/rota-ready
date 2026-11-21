import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { StaffLinkPageError } from '@/features/staff-links/staff-link-page-error';
import { staffLinkPageQuery } from '@/features/staff-links/staff-link-queries';
import { UpcomingShifts } from '@/features/staff-links/upcoming-shifts';

export const Route = createFileRoute('/s/$token')({
  loader: ({ context, params }) => context.queryClient.query(staffLinkPageQuery(params.token)),
  errorComponent: StaffLinkPageError,
  component: StaffLinkPage,
});

function StaffLinkPage() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const { data: page } = useSuspenseQuery(staffLinkPageQuery(token));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">
          {t('staffLink.page.greeting', { firstName: page.firstName })}
        </h1>
        <p className="text-muted-foreground">
          {t('staffLink.page.description', { venueName: page.venueName })}
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t('staffLink.page.shifts')}</h2>
        <UpcomingShifts shifts={page.shifts} timeZone={page.timeZone} />
      </section>
    </main>
  );
}
