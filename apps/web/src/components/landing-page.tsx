import { Link } from '@tanstack/react-router';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
  const proFeatures = [
    t('landing.plans.pro.notifications'),
    t('landing.plans.pro.reminders'),
    t('landing.plans.pro.staff'),
    t('landing.plans.pro.venues'),
    t('landing.plans.pro.managers'),
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
                <FeatureList features={freeFeatures} />
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to="/signup">{t('landing.startFree')}</Link>
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <h3 className="text-xl">{t('landing.plans.pro.name')}</h3>
                  <Badge variant="secondary">{t('landing.plans.pro.comingSoon')}</Badge>
                </CardTitle>
                <CardDescription>{t('landing.plans.pro.description')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <FeatureList features={proFeatures} />
                <p className="text-sm text-muted-foreground">
                  {t('landing.plans.pro.textAllowance')}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}

function FeatureList({ features }: { features: string[] }) {
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
