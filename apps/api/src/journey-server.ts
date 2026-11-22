import express from 'express';
import { z } from 'zod';
import { createApp } from '#src/app.js';
import { parseBody } from '#src/lib/http-errors.js';
import { serverDependenciesFromEnv } from '#src/server-dependencies.js';

const journeyClockSchema = z.object({ now: z.iso.datetime() });

const startsAt = journeyClockSchema.safeParse({ now: process.env.JOURNEY_NOW });
if (!startsAt.success) throw new Error('JOURNEY_NOW must be an ISO date and time');

let now = new Date(startsAt.data.now);
const { dependencies, port } = serverDependenciesFromEnv();
const journey = express();

journey.put('/test/clock', express.json(), (req, res) => {
  const request = parseBody(journeyClockSchema, req.body, res);
  if (!request) return;
  now = new Date(request.now);
  res.status(204).end();
});
journey.use(createApp({ ...dependencies, clock: { now: () => new Date(now) } }));

journey.listen(port, () => {
  dependencies.logger.info({ port, now }, 'Journey API listening');
});
