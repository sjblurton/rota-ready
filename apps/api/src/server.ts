import { pino } from 'pino';
import { createApp } from './app.js';
import { DEFAULT_ASK_PING_INTERVAL_MS } from '#src/features/rota/ask-settings.js';
import { parseStaffLinkKey } from '#src/features/staff-links/staff-link-token.js';
import {
  anthropicAnswerModel,
  DEFAULT_ASK_MAX_TOKENS,
  DEFAULT_ASK_MODEL,
} from '#src/lib/answer-model.js';
import { supabaseAuthConfig } from '#src/lib/auth.js';
import { createDb } from '#src/lib/db.js';
import { smtpEmailSender } from '#src/lib/email-sender.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL is not set');

const staffLinkKey = process.env.STAFF_LINK_KEY;
if (!staffLinkKey) throw new Error('STAFF_LINK_KEY is not set');

const smtpUrl = process.env.SMTP_URL;
if (!smtpUrl) throw new Error('SMTP_URL is not set');

const emailFrom = process.env.EMAIL_FROM;
if (!emailFrom) throw new Error('EMAIL_FROM is not set');

const webUrl = process.env.WEB_URL;
if (!webUrl) throw new Error('WEB_URL is not set');

const askMaxTokens = Number(process.env.ASK_MAX_TOKENS ?? DEFAULT_ASK_MAX_TOKENS);
if (!Number.isInteger(askMaxTokens) || askMaxTokens < 1) {
  throw new Error('ASK_MAX_TOKENS must be a whole number above 0');
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const answerModel = anthropicApiKey
  ? anthropicAnswerModel({
      apiKey: anthropicApiKey,
      model: process.env.ASK_MODEL ?? DEFAULT_ASK_MODEL,
      maxTokens: askMaxTokens,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    })
  : null;

const port = Number(process.env.PORT ?? 3000);
const logger = pino({
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  ...(process.env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
});

createApp({
  db: createDb(databaseUrl),
  clock: { now: () => new Date() },
  authConfig: supabaseAuthConfig(supabaseUrl),
  logger,
  staffLinkKey: parseStaffLinkKey(staffLinkKey),
  emailSender: smtpEmailSender({ url: smtpUrl, from: emailFrom }),
  webUrl,
  answerModel,
  askSettings: { pingIntervalMs: DEFAULT_ASK_PING_INTERVAL_MS },
}).listen(port, () => {
  logger.info({ port }, 'API listening');
});
