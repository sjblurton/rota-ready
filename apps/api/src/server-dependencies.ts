import { pino } from 'pino';
import type { AppDependencies } from '#src/app.js';
import { parseStaffLinkKey } from '#src/features/staff-links/staff-link-token.js';
import { supabaseAuthConfig } from '#src/lib/auth.js';
import { createDb } from '#src/lib/db.js';
import { smtpEmailSender } from '#src/lib/email-sender.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function serverDependenciesFromEnv(): {
  dependencies: Omit<AppDependencies, 'clock'>;
  port: number;
} {
  const logger = pino({
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    ...(process.env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
  });
  return {
    dependencies: {
      db: createDb(required('DATABASE_URL')),
      authConfig: supabaseAuthConfig(required('SUPABASE_URL')),
      logger,
      staffLinkKey: parseStaffLinkKey(required('STAFF_LINK_KEY')),
      emailSender: smtpEmailSender({ url: required('SMTP_URL'), from: required('EMAIL_FROM') }),
      webUrl: required('WEB_URL'),
    },
    port: Number(process.env.PORT ?? 3000),
  };
}
