-- ============================================================
-- 0006: lock the public schema down for Supabase.
--
-- Supabase exposes every table in the `public` schema through an
-- auto-generated REST API (the "Data API"). Tables created with SQL
-- have Row Level Security OFF, so anyone holding the project's public
-- (anon) key could read tables like users/drivers, including password
-- hashes. This app never uses that API: the FastAPI backend connects
-- straight to Postgres. So we turn RLS on for every table (with no
-- policies, the API sees nothing) and revoke the API roles' grants.
--
-- Safe on plain Postgres (local Docker) too: the anon/authenticated
-- roles only exist on Supabase, and the postgres role bypasses RLS, so
-- the backend is unaffected.
--
-- Guard: if the role running this can NOT bypass RLS, enabling it would
-- lock the backend out of its own tables, so this refuses to run.
-- ============================================================

DO $$
DECLARE
    t text;
    r text;
BEGIN
    IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
        RAISE EXCEPTION
            'Refusing to enable RLS: role "%" cannot bypass row level security, so the backend would lose access to its tables. Run this as the postgres role.',
            current_user;
    END IF;

    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;

    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
        END IF;
    END LOOP;
END
$$;