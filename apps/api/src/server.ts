import { createApp } from './app.js';
import { supabaseAuthConfig } from './auth.js';
import { createDb } from './db.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL is not set');

const port = Number(process.env.PORT ?? 3000);

createApp({
  db: createDb(databaseUrl),
  authConfig: supabaseAuthConfig(supabaseUrl),
}).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
