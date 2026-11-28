import type { Clock } from '#src/lib/clock.js';

interface QuestionLimit {
  questions: number;
  withinMs: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createQuestionLimiter(
  clock: Clock,
  { questionsPerTenMinutes, questionsPerDay }: { questionsPerTenMinutes: number; questionsPerDay: number },
) {
  const limits: QuestionLimit[] = [
    { questions: questionsPerTenMinutes, withinMs: TEN_MINUTES_MS },
    { questions: questionsPerDay, withinMs: DAY_MS },
  ];
  const askedAtByUser = new Map<string, number[]>();

  return {
    tryToAsk(userId: string): boolean {
      const now = clock.now().getTime();
      const askedToday = (askedAtByUser.get(userId) ?? []).filter((askedAt) => now - askedAt < DAY_MS);
      const withinLimits = limits.every(
        ({ questions, withinMs }) => askedToday.filter((askedAt) => now - askedAt < withinMs).length < questions,
      );
      if (withinLimits) askedToday.push(now);
      askedAtByUser.set(userId, askedToday);
      return withinLimits;
    },
  };
}
