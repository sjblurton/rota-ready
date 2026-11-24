import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlanFeatureList } from '@/features/plans/plan-feature-list';
import { ProPlanCard } from '@/features/plans/pro-plan-card';

export function LandingPage() {
  const { t } = useTranslation();
  const steps = [
    { title: t('landing.howItWorks.build.title'), body: t('landing.howItWorks.build.body') },
    { title: t('landing.howItWorks.publish.title'), body: t('landing.howItWorks.publish.body') },
    { title: t('landing.howItWorks.confirm.title'), body: t('landing.howItWorks.confirm.body') },
  ];
  const freeFeatures = [
    t('landing.plans.free.venue'),
    t('landing.plans.free.staff'),
    t('landing.plans.free.rotas'),
    t('landing.plans.free.responses'),
    t('landing.plans.free.copyLinks'),
  ];

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-app items-center justify-between gap-4 px-6 py-3 sm:px-10">
          <span className="font-medium">{t('app.name')}</span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">{t('landing.logIn')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">{t('landing.signUp')}</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-app flex-col gap-16 px-6 py-12 sm:px-10 sm:py-20">
        <section className="flex max-w-2xl flex-col items-start gap-6">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('landing.title')}
          </h1>
          <p className="text-lg text-muted-foreground">{t('landing.pitch')}</p>
          <Button asChild size="lg">
            <Link to="/signup">{t('landing.startFree')}</Link>
          </Button>
        </section>
        <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
          <h2 id="how-it-works" className="text-2xl font-semibold">
            {t('landing.howItWorks.title')}
          </h2>
          <ol className="grid list-inside list-decimal gap-6 marker:text-lg marker:font-semibold marker:text-primary sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.title}>
                <h3 className="inline font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="plans" className="flex flex-col gap-6">
          <h2 id="plans" className="text-2xl font-semibold">
            {t('landing.plans.title')}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3 className="text-xl">{t('landing.plans.free.name')}</h3>
                </CardTitle>
                <CardDescription>{t('landing.plans.free.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <PlanFeatureList features={freeFeatures} />
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to="/signup">{t('landing.startFree')}</Link>
                </Button>
              </CardFooter>
            </Card>
            <ProPlanCard />
          </div>
        </section>
      </main>
    </>
  );
}

