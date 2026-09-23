-- ---------------------------------------------------------------------
-- Emulacion del esquema auth de Supabase (mismo patron que Regalapp).
--
-- En Supabase el esquema auth ya existe y es de otro rol: todo este
-- bloque esta guardado y solo hace algo en PGlite (tests).
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
  end if;
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'
    $fn$;
  end if;
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
exception
  when insufficient_privilege then null;
end
$$;

do $$
begin
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
exception
  when insufficient_privilege then null;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
