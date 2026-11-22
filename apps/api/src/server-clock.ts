import { fixedClock, systemClock, type Clock } from '#src/lib/clock.js';

interface ClockEnv {
  CLOCK_FIXED_AT?: string | undefined;
  NODE_ENV?: string | undefined;
}

export function serverClock({ CLOCK_FIXED_AT: fixedAt, NODE_ENV: nodeEnv }: ClockEnv): Clock {
  if (fixedAt === undefined) return systemClock;
  if (nodeEnv !== 'development') {
    throw new Error('CLOCK_FIXED_AT is only accepted when NODE_ENV is development');
  }
  const instant = new Date(fixedAt);
  if (Number.isNaN(instant.getTime())) throw new Error('CLOCK_FIXED_AT is not a date and time');
  return fixedClock(instant);
}
