-- 2.4.0: banco hospedado (Supabase) expoe o schema "public" por uma API propria (PostgREST) para os papeis anon e
-- authenticated. Este projeto so' acessa o banco pelo backend (dono das tabelas), entao NADA deve ficar acessivel a
-- esses papeis: liga a seguranca por linha (RLS) sem nenhuma politica (= negar tudo a quem nao e' o dono) e revoga
-- os privilegios, se esses papeis existirem. O dono das tabelas (o backend) nao e' afetado pelo RLS.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
  END IF;
END
$$;
