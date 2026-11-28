import { apiErrorCode, feature, planAllows } from '@rota-ready/shared';
import { RotaStatus, type Venue } from '#src/generated/prisma/client.js';
import type { AnswerModel } from '#src/lib/answer-model.js';
import type { Clock } from '#src/lib/clock.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import { findRotaToAskAbout } from './ask-data.js';
import { askPrompt } from './ask-prompt.js';
import type { AskSettings } from './ask-settings.js';
import { createAskRateLimit } from './ask-rate-limit.js';

export interface AskServiceDependencies {
  db: Db;
  answerModel: AnswerModel | null;
  clock: Clock;
  askSettings: AskSettings;
}

export function createAskService({ db, answerModel, clock, askSettings }: AskServiceDependencies) {
  const rateLimit = createAskRateLimit(clock, askSettings);

  function isAvailableFor(venue: Pick<Venue, 'plan'>) {
    return answerModel !== null && planAllows[venue.plan].features.includes(feature.ask_about_this_week);
  }

  return {
    isAvailableFor,

    async ask(
      venue: Venue,
      userId: string,
      weekStart: string,
      question: string,
      signal: AbortSignal,
    ): Promise<{ ok: true; answer: AsyncIterable<string> } | Refused<'ask_unavailable' | 'ask_rate_limited'>> {
      if (!answerModel || !isAvailableFor(venue)) return refuse(apiErrorCode.ask_unavailable);
      if (!rateLimit.tryToAsk(userId)) return refuse(apiErrorCode.ask_rate_limited);
      const rota = await findRotaToAskAbout(db, venue.id, weekStart);
      const week = {
        venue,
        weekStart,
        status: rota?.status ?? RotaStatus.draft,
        shifts: rota?.shifts ?? [],
      };
      return { ok: true, answer: answerModel.streamAnswer({ ...askPrompt(week, question), signal }) };
    },
  };
}

export type AskService = ReturnType<typeof createAskService>;
