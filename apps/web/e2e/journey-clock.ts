import type { BrowserContext } from '@playwright/test';
import { apiPort } from './journey-servers';

export const JOURNEY_NOW = '2025-11-17T08:00:00.000Z';

let journeyNow = JOURNEY_NOW;
const openContexts = new Set<BrowserContext>();

export async function installJourneyClock(context: BrowserContext) {
  await context.clock.install({ time: new Date(journeyNow) });
  openContexts.add(context);
  context.on('close', () => openContexts.delete(context));
}

export async function moveJourneyClockTo(instant: string) {
  const response = await fetch(`http://localhost:${apiPort}/test/clock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ now: instant }),
  });
  if (response.status !== 204) throw new Error(`The journey API refused the clock: ${response.status}`);
  journeyNow = instant;
  for (const context of openContexts) await context.clock.setSystemTime(new Date(instant));
}
