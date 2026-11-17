import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

const TEST_DATABASE = 'rota_ready_test';

export default async function setup(project: TestProject) {
  const rootEnv = new URL('../../../.env', import.meta.url);
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${TEST_DATABASE}`;

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  await admin.end();

  const testDb = new pg.Client({ connectionString: testUrl.href });
  await testDb.connect();
  await testDb.query(
    readFileSync(new URL('./supabase-public-defaults.sql', import.meta.url), 'utf8'),
  );
  await testDb.end();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: testUrl.href },
    stdio: 'pipe',
  });

  project.provide('databaseUrl', testUrl.href);
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
