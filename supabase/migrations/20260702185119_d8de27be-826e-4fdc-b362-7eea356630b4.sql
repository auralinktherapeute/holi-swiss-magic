
-- 1. Fix missing Data-API grants (schema-remix issue). Bulk grant to authenticated + service_role on all public tables that currently lack them.
DO $$
DECLARE
    tbl record;
    has_priv boolean;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r' AND n.nspname = 'public'
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='authenticated' AND table_schema='public' AND table_name=tbl.table_name
               AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
        ) INTO has_priv;
        IF NOT has_priv THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='service_role' AND table_schema='public' AND table_name=tbl.table_name
               AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
        ) INTO has_priv;
        IF NOT has_priv THEN
            EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
        END IF;
    END LOOP;
END;
$$;

-- Public directory needs anon read for therapists (active profiles are public)
GRANT SELECT ON public.therapists TO anon;

-- 2. Add missing columns / FK on crm_tasks referenced by application code
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.crm_client_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS crm_tasks_contact_id_idx ON public.crm_tasks(contact_id);
