-- Secure Schemas: Enable Row Level Security (RLS) on all tables in v2_testnet and v2_mainnet
-- and revoke all privileges from anon and authenticated roles.
-- Idempotent and safe to run repeatedly after any schema migration or push.

DO $$
DECLARE
    target_schema TEXT;
    target_table RECORD;
BEGIN
    FOR target_schema IN SELECT unnest(ARRAY['v2_testnet', 'v2_mainnet'])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = target_schema) THEN
            -- Revoke all usage on schema
            BEGIN
                EXECUTE format('REVOKE ALL ON SCHEMA %I FROM anon, authenticated;', target_schema);
            EXCEPTION WHEN undefined_object THEN
                -- In local or standalone postgres where anon/authenticated roles do not exist
                NULL;
            END;

            -- Enable RLS and revoke access on every table
            FOR target_table IN
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = target_schema
                  AND table_type = 'BASE TABLE'
            LOOP
                EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', target_schema, target_table.table_name);
                BEGIN
                    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated;', target_schema, target_table.table_name);
                EXCEPTION WHEN undefined_object THEN
                    NULL;
                END;
            END LOOP;
        END IF;
    END LOOP;
END $$;
