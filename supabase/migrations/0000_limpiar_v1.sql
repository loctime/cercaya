-- CercaYa v2 arranca con la base limpia.
-- Verificado 23/09/2026: produccion tenia 0 perfiles, 0 prestadores,
-- 0 pedidos y 0 resenas. El esquema v1 queda en supabase/legacy/.

drop function if exists public.providers_near(float, float, float, int);

drop table if exists public.reviews cascade;
drop table if exists public.applications cascade;
drop table if exists public.job_requests cascade;
drop table if exists public.provider_services cascade;
drop table if exists public.providers cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;
