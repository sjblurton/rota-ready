import pg from 'pg';
import { z } from 'zod';

const WAKE_UP_TIMEOUT_MS = 120_000;
const CLIENT_ROLES = ['anon', 'authenticated'];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const webUrl = requiredEnv('WEB_URL');
const supabaseUrl = requiredEnv('SUPABASE_URL');
const publishableKey = requiredEnv('SUPABASE_PUBLISHABLE_KEY');
const databaseUrl = requiredEnv('DATABASE_URL');

const client = new pg.Client({ connectionString: databaseUrl });

const jwksSchema = z.object({ keys: z.array(z.object({ alg: z.string().optional() })) });

type Check = () => Promise<string | undefined>;

const checks: Record<string, Check> = {
  async 'the web app forwards /api to a healthy API and database'() {
    const response = await fetch(new URL('/api/health', webUrl), {
      signal: AbortSignal.timeout(WAKE_UP_TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => undefined);
    const healthy = JSON.stringify(body) === JSON.stringify({ api: 'ok', db: 'ok' });
    return healthy ? undefined : `got ${response.status} ${JSON.stringify(body)}`;
  },

  async 'the web app serves the SPA for client-side routes'() {
    const response = await fetch(new URL('/venues/some-id', webUrl));
    const html = await response.text();
    return response.ok && html.includes('<div id="root">')
      ? undefined
      : `got ${response.status}`;
  },

  async 'Supabase Auth signs tokens with an asymmetric key (ES256 or RS256)'() {
    const response = await fetch(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl));
    const { keys } = jwksSchema.parse(await response.json());
    const algorithms = keys.map(({ alg }) => alg);
    return algorithms.some((alg) => alg === 'ES256' || alg === 'RS256')
      ? undefined
      : `JWKS algorithms: ${JSON.stringify(algorithms)}`;
  },

  async 'the Data API returns no table data to the publishable key'() {
    for (const path of ['/rest/v1/', '/rest/v1/users?select=*', '/rest/v1/venues?select=*']) {
      const response = await fetch(new URL(path, supabaseUrl), {
        headers: { apikey: publishableKey },
      });
      if (response.ok) return `${path} answered ${response.status}`;
    }
    return undefined;
  },

  async 'every public table has RLS enabled'() {
    const { rows } = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity`,
    );
    return rows.length === 0 ? undefined : `without RLS: ${rows.map((r) => r.relname)}`;
  },

  async 'anon and authenticated have no grants on public tables'() {
    const { rows } = await client.query<{ grant: string }>(
      `SELECT grantee || ' ' || privilege_type || ' ' || table_name AS grant
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND grantee = ANY($1)`,
      [CLIENT_ROLES],
    );
    return rows.length === 0 ? undefined : `grants: ${rows.map((r) => r.grant)}`;
  },

  async 'anon and authenticated have no grants on public sequences or functions'() {
    const { rows } = await client.query<{ grant: string }>(
      `SELECT grantee || ' USAGE ' || object_name AS grant
       FROM information_schema.role_usage_grants
       WHERE object_schema = 'public' AND object_type = 'SEQUENCE' AND grantee = ANY($1)
       UNION ALL
       SELECT grantee || ' ' || privilege_type || ' ' || routine_name
       FROM information_schema.role_routine_grants
       WHERE routine_schema = 'public' AND grantee = ANY($1)`,
      [CLIENT_ROLES],
    );
    return rows.length === 0 ? undefined : `grants: ${rows.map((r) => r.grant)}`;
  },

  async 'the event trigger that enables RLS on new tables is installed'() {
    const { rows } = await client.query<{ evtenabled: string }>(
      `SELECT evtenabled FROM pg_event_trigger
       WHERE evtname = 'enable_rls_on_new_public_tables'`,
    );
    return rows[0]?.evtenabled === 'O' ? undefined : `found ${JSON.stringify(rows)}`;
  },
};

await client.connect();
let failures = 0;
try {
  for (const [name, check] of Object.entries(checks)) {
    const problem = await check().catch((error: unknown) => String(error));
    if (problem) failures += 1;
    process.stdout.write(`${problem ? '✗' : '✓'} ${name}${problem ? `: ${problem}` : ''}\n`);
  }
} finally {
  await client.end();
}
process.exitCode = failures === 0 ? 0 : 1;
