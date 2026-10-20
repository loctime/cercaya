-- Punto estable por celda y por persona. Nunca se usa para entregar el punto crudo.
create or replace function public.difuminar(p_lat float8, p_lng float8, p_user uuid, p_celda float8)
returns table (lat float8, lng float8)
language sql immutable set search_path = public as $$
  with o as (
    select (mod(abs(hashtext(p_user::text || 'lat')::bigint), 10000) / 10000.0) * p_celda a,
           (mod(abs(hashtext(p_user::text || 'lng')::bigint), 10000) / 10000.0) * p_celda b
  ) select (floor((p_lat + a) / p_celda) + .5) * p_celda - a,
           (floor((p_lng + b) / p_celda) + .5) * p_celda - b from o
$$;
revoke all on function public.difuminar(float8, float8, uuid, float8) from public, anon, authenticated;
