-- Supabase grants its client-facing roles full access to everything the
-- `postgres` role creates in `public`. The API is the only way into the data.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- RLS with no policies on every table: a safety net if grants come back.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE FUNCTION private.enable_rls_on_new_public_tables()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  created record;
BEGIN
  FOR created IN
    SELECT object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE object_type = 'table' AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', created.object_identity);
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER enable_rls_on_new_public_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION private.enable_rls_on_new_public_tables();

DO $$
DECLARE
  existing record;
BEGIN
  FOR existing IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', existing.schemaname, existing.tablename);
  END LOOP;
END;
$$;
