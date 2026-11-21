import { pino } from 'pino';
import { createApp } from './app.js';
import { supabaseAuthConfig } from './auth.js';
import { createDb } from './db.js';
import { parseStaffLinkKey } from './staff-link-token.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL is not set');

const staffLinkKey = process.env.STAFF_LINK_KEY;
if (!staffLinkKey) throw new Error('STAFF_LINK_KEY is not set');

const port = Number(process.env.PORT ?? 3000);
const logger = pino({
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  ...(process.env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
});

createApp({
  db: createDb(databaseUrl),
  authConfig: supabaseAuthConfig(supabaseUrl),
  logger,
  staffLinkKey: parseStaffLinkKey(staffLinkKey),
}).listen(port, () => {
  logger.info({ port }, 'API listening');
});
