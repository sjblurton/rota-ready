import pg from 'pg';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

const client = new pg.Client({ connectionString: inject('databaseUrl') });

beforeAll(() => client.connect());
afterAll(() => client.end());

beforeEach(async () => {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const tables = rows
    .map(({ tablename }) => `public.${client.escapeIdentifier(tablename)}`)
    .join(', ');
  await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
});
