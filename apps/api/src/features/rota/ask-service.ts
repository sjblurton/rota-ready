import { apiErrorCode, feature, planAllows } from '@rota-ready/shared';
import { RotaStatus, type Venue } from '#src/generated/prisma/client.js';
import type { AnswerModel } from '#src/lib/answer-model.js';
import type { Db } from '#src/lib/db.js';
import { refuse, type Refused } from '#src/lib/service-result.js';
import { findRotaToAskAbout } from './ask-data.js';
import { askPrompt } from './ask-prompt.js';

export interface AskServiceDependencies {
  db: Db;
  answerModel: AnswerModel | null;
}

export function createAskService({ db, answerModel }: AskServiceDependencies) {
  function isAvailableFor(venue: Pick<Venue, 'plan'>) {
    return answerModel !== null && planAllows[venue.plan].features.includes(feature.ask_about_this_week);
  }

  return {
    isAvailableFor,

    async ask(
      venue: Venue,
      weekStart: string,
      question: string,
      signal: AbortSignal,
    ): Promise<{ ok: true; answer: AsyncIterable<string> } | Refused<'ask_unavailable'>> {
      if (!answerModel || !isAvailableFor(venue)) return refuse(apiErrorCode.ask_unavailable);
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
