import { apiErrorCode, askRequestSchema, type ApiErrorCode, type AskRequest } from '@rota-ready/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { askStatus, useAskAboutThisWeek, type AskState } from '@/features/rota/ask-about-this-week';
import { venueQuery } from '@/features/venues/venue-queries';
import { apiErrorCodeMessage } from '@/i18n/api-error-message';

function retryCanFix(code: ApiErrorCode | undefined) {
  return code === undefined || code === apiErrorCode.ask_failed || code === apiErrorCode.internal_error;
}

function keepFocusWhenStopGoes(stopButton: HTMLButtonElement) {
  const form = stopButton.form;
  return () => {
    if (document.activeElement !== stopButton) return;
    const question = form?.elements.namedItem('question');
    if (question instanceof HTMLInputElement) question.focus();
  };
}

interface AskAboutThisWeekPanelProps {
  venueId: string;
  weekStart: string;
}

function announcement(t: TFunction, state: AskState): string {
  switch (state.status) {
    case askStatus.idle:
      return '';
    case askStatus.streaming:
      return t('rota.ask.answering');
    case askStatus.answered:
      return state.answer;
    case askStatus.stopped:
      return t('rota.ask.stopped');
    case askStatus.failed:
      return apiErrorCodeMessage(t, state.code);
  }
}

export function AskAboutThisWeekPanel({ venueId, weekStart }: AskAboutThisWeekPanelProps) {
  const { t } = useTranslation();
  const { data: venue } = useSuspenseQuery(venueQuery(venueId));
  const { state, ask, stop, retry } = useAskAboutThisWeek(venueId, weekStart);
  const form = useForm({ resolver: zodResolver(askRequestSchema), defaultValues: { question: '' } });
  const error = form.formState.errors.question;
  const streaming = state.status === askStatus.streaming;
  const stopped = state.status === askStatus.stopped;

  if (!venue.canAskAboutThisWeek) return null;

  function onSubmit({ question }: AskRequest) {
    ask(question);
    form.setFocus('question');
  }


  function onStop() {
    stop();
    form.setFocus('question');
  }

  function onRetry() {
    retry();
    form.setFocus('question');
  }

  return (
    <Card role="region" aria-labelledby="ask-title">
      <CardHeader>
        <CardTitle>
          <h3 id="ask-title">{t('rota.ask.title')}</h3>
        </CardTitle>
        <CardDescription>{t('rota.ask.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={form.handleSubmit(onSubmit)}>
          <Field data-invalid={!!error} className="flex-1">
            <FieldLabel htmlFor="ask-question">{t('rota.ask.question')}</FieldLabel>
            <Input
              id="ask-question"
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby="ask-question-error"
              {...form.register('question')}
            />
            <FieldError id="ask-question-error" errors={[error]} />
          </Field>
          <Button type="submit" className="sm:mt-6" disabled={streaming}>
            {t('rota.ask.submit')}
          </Button>
          {streaming && (
            <Button ref={keepFocusWhenStopGoes} type="button" variant="outline" className="sm:mt-6" onClick={onStop}>
              {t('rota.ask.stop')}
            </Button>
          )}
        </form>
        {(streaming || stopped || state.answer !== '') && (
          <section aria-labelledby="ask-answer-heading" aria-busy={streaming} className="flex flex-col gap-1">
            <h4 id="ask-answer-heading" className="text-sm font-medium">
              {t('rota.ask.answer')}
            </h4>
            <p className="text-sm whitespace-pre-wrap">{state.answer}</p>
            {stopped && (
              <p className="text-sm text-muted-foreground">{t('rota.ask.stopped')}</p>
            )}
          </section>
        )}
        {state.status === askStatus.failed && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-destructive">{apiErrorCodeMessage(t, state.code)}</p>
            {retryCanFix(state.code) && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                {t('rota.ask.retry')}
              </Button>
            )}
          </div>
        )}
        <p role="status" className="sr-only">
          {announcement(t, state)}
        </p>
      </CardContent>
    </Card>
  );
}
