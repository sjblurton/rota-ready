import pg from 'pg';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { createDb, type Db } from './db.js';

const CLIENT_ROLES = ['anon', 'authenticated'];

describe('database security baseline', () => {
  let client: pg.Client;

  beforeEach(async () => {
    client = new pg.Client({ connectionString: inject('databaseUrl') });
    await client.connect();
  });

  afterEach(() => client.end());

  async function publicTablesWithoutRls() {
    const { rows } = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    );
    return rows.map(({ relname }) => relname);
  }

  async function clientRoleTableGrants() {
    const { rows } = await client.query<{ grant: string }>(
      `SELECT grantee || ' ' || privilege_type || ' ' || table_name AS grant
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND grantee = ANY($1)`,
      [CLIENT_ROLES],
    );
    return rows.map(({ grant }) => grant);
  }

  describe('when the migrations have run', () => {
    it('enables RLS on every table in public', async () => {
      expect(await publicTablesWithoutRls()).toEqual([]);
    });

    it('grants nothing on public tables to anon or authenticated', async () => {
      expect(await clientRoleTableGrants()).toEqual([]);
    });

    it('leaves anon and authenticated no default privileges on new public objects', async () => {
      const { rows } = await client.query(
        `SELECT acl.grantee::regrole::text AS grantee, d.defaclobjtype
         FROM pg_default_acl d
         JOIN pg_namespace n ON n.oid = d.defaclnamespace,
         LATERAL aclexplode(d.defaclacl) acl
         WHERE n.nspname = 'public' AND acl.grantee::regrole::text = ANY($1)`,
        [CLIENT_ROLES],
      );
      expect(rows).toEqual([]);
    });
  });

  describe('when a later migration creates a table', () => {
    beforeEach(() => client.query('CREATE TABLE public.later_table (id int)'));

    afterEach(() => client.query('DROP TABLE public.later_table'));

    it('enables RLS on it automatically', async () => {
      expect(await publicTablesWithoutRls()).toEqual([]);
    });

    it('grants nothing on it to anon or authenticated', async () => {
      expect(await clientRoleTableGrants()).toEqual([]);
    });

    describe('when the API writes to it and reads it back through Prisma', () => {
      let db: Db;
      let rows: { id: number }[];

      beforeEach(async () => {
        db = createDb(inject('databaseUrl'));
        await db.$executeRaw`INSERT INTO public.later_table (id) VALUES (42)`;
        rows = await db.$queryRaw<{ id: number }[]>`SELECT id FROM public.later_table`;
      });

      afterEach(() => db.$disconnect());

      it('sees its own row despite RLS', () => {
        expect(rows).toEqual([{ id: 42 }]);
      });
    });
  });
});
