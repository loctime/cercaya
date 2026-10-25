-- =====================================================================
-- Disponibilidad para trabajitos.
--
--  * "Disponible ahora": profile_private.disponible_hasta. Se activa con
--    estoy_disponible(horas) (1 a 24, por defecto 8) y se apaga solo al
--    vencer, para que nadie quede disponible por olvido. Nadie la edita a mano.
--  * "Que trabajitos acepto": oficios.acepta_pedidos. Una habilidad apagada no
--    se encuentra en las busquedas.
--  * En Trabajo los disponibles salen primero y se puede filtrar solo ellos.
--  * Aviso diario a la manania ("Estas disponible hoy para trabajitos?").
-- =====================================================================

alter table public.profile_private add column disponible_hasta timestamptz;
alter table public.oficios add column acepta_pedidos boolean not null default true;

grant update (acepta_pedidos) on public.oficios to authenticated;

-- ---------------------------------------------------------------------
-- Estar disponible (la unica via para escribir disponible_hasta)
-- ---------------------------------------------------------------------
create or replace function public.estoy_disponible(p_horas int default 8)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  hasta timestamptz;
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  if p_horas is null or p_horas not between 1 and 24 then
    raise exception 'Las horas tienen que ser entre 1 y 24';
  end if;
  if not exists (select 1 from profile_private where user_id = yo and ofrece_servicios) then
    raise exception 'Activá Ofrezco servicios para poder avisar que estás disponible';
  end if;
  hasta := now() + make_interval(hours => p_horas);
  update profile_private set disponible_hasta = hasta where user_id = yo;
  return hasta;
end
$$;

create or replace function public.ya_no_disponible()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesion'; end if;
  update profile_private set disponible_hasta = null where user_id = auth.uid();
end
$$;

-- Sin "Ofrezco servicios" no hay disponibilidad.
create or replace function public.limpiar_disponible_si_no_ofrece()
returns trigger
language plpgsql
as $$
begin
  if not new.ofrece_servicios then
    new.disponible_hasta := null;
  end if;
  return new;
end
$$;

create trigger profile_private_limpia_disponible
  before update of ofrece_servicios on public.profile_private
  for each row execute function public.limpiar_disponible_si_no_ofrece();

revoke all on function public.estoy_disponible(int), public.ya_no_disponible(), public.limpiar_disponible_si_no_ofrece()
  from public, anon, authenticated;
grant execute on function public.estoy_disponible(int), public.ya_no_disponible() to authenticated;

-- ---------------------------------------------------------------------
-- buscar_servicio: disponible, orden y filtro. La firma nueva admite la llamada
-- vieja de dos argumentos (el tercero tiene valor por defecto).
-- ---------------------------------------------------------------------
drop function if exists public.buscar_servicio(text, int);

create or replace function public.buscar_servicio(
  p_texto text, p_radio_km int default 15, p_solo_disponibles boolean default false
)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], coincide text, es_contacto boolean, lat float8, lng float8, disponible boolean
)
language sql stable security definer set search_path = public as $$
  with q as (
    select palabras_busqueda(p_texto) palabras
     where cardinality(palabras_busqueda(p_texto)) > 0
  ), yo as (
    select lat, lng from profile_private where user_id = auth.uid() and lat is not null and lng is not null
  ), candidatos as (
    select p.id, p.full_name, p.avatar_url, pv.location_precision, d.lat dlat, d.lng dlng,
           coalesce(pv.disponible_hasta > now(), false) disp
      from profile_private pv
      join profiles p on p.id = pv.user_id
      cross join lateral difuminar(pv.lat, pv.lng, p.id, 0.015) d
     where auth.uid() is not null
       and pv.ofrece_servicios
       and (not coalesce(p_solo_disponibles, false) or coalesce(pv.disponible_hasta > now(), false))
       and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days'
       and p.id <> auth.uid()
       and not bloqueado(auth.uid(), p.id)
  )
  select c.id, c.full_name, c.avatar_url, zona_de(c.dlat, c.dlng, c.location_precision),
         distancia_publica(dist_km(yo.lat, yo.lng, c.dlat, c.dlng)),
         coalesce((select array_agg(o.label order by o.label) from (
           select label from oficios where user_id = c.id order by label limit 5) o), '{}'),
         m.label, es_contacto(auth.uid(), c.id), c.dlat, c.dlng, c.disp
    from candidatos c
    cross join yo
    cross join q
    cross join lateral (
      select o.label
        from oficios o left join habilidades_catalogo h on h.id = o.catalog_id
       where o.user_id = c.id
         and o.acepta_pedidos
         and not exists (
           select 1 from unnest(q.palabras) palabra
            where normalizar_busqueda(o.label || ' ' || coalesce(array_to_string(h.aliases, ' '), '')) not like '%' || palabra || '%'
         )
       order by o.label
       limit 1
    ) m
   where dist_km(yo.lat, yo.lng, c.dlat, c.dlng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
   order by c.disp desc, dist_km(yo.lat, yo.lng, c.dlat, c.dlng), c.full_name
   limit 30
$$;

revoke all on function public.buscar_servicio(text, int, boolean) from public, anon, authenticated;
grant execute on function public.buscar_servicio(text, int, boolean) to authenticated;

-- "Gente cerca que puede ayudarte" (Contactos) tambien respeta las habilidades apagadas.
create or replace function public.buscar_habilidades_cerca(p_texto text, p_radio_km int default 15)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], estado text, lat float8, lng float8
)
language sql stable security definer set search_path = public as $$
  with q as (
    select palabras_busqueda(p_texto) palabras
     where cardinality(palabras_busqueda(p_texto)) > 0
  ), yo as (
    select lat, lng from profile_private where user_id = auth.uid() and lat is not null and lng is not null
  ), candidatos as (
    select p.id, p.full_name, p.avatar_url, pv.location_precision, d.lat dlat, d.lng dlng
      from profile_private pv
      join profiles p on p.id = pv.user_id
      cross join lateral difuminar(pv.lat, pv.lng, p.id, 0.015) d
     where auth.uid() is not null and pv.es_publico and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days' and p.id <> auth.uid()
       and not bloqueado(auth.uid(), p.id) and not es_contacto(auth.uid(), p.id)
  )
  select c.id, c.full_name, c.avatar_url, zona_de(c.dlat, c.dlng, c.location_precision),
         distancia_publica(dist_km(yo.lat, yo.lng, c.dlat, c.dlng)),
         coalesce((select array_agg(o.label order by o.label) from (
           select label from oficios where user_id = c.id order by label limit 5) o), '{}'),
         case when exists (select 1 from contacts k where k.requester_id = auth.uid() and k.addressee_id = c.id) then 'enviada'
              when exists (select 1 from contacts k where k.addressee_id = auth.uid() and k.requester_id = c.id) then 'recibida' end,
         c.dlat, c.dlng
    from candidatos c cross join yo cross join q
   where dist_km(yo.lat, yo.lng, c.dlat, c.dlng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
     and exists (
       select 1 from oficios o left join habilidades_catalogo h on h.id = o.catalog_id
        where o.user_id = c.id
          and o.acepta_pedidos
          and not exists (
            select 1 from unnest(q.palabras) palabra
             where normalizar_busqueda(o.label || ' ' || coalesce(array_to_string(h.aliases, ' '), '')) not like '%' || palabra || '%'
          )
     )
   order by dist_km(yo.lat, yo.lng, c.dlat, c.dlng), c.full_name
   limit 30
$$;

revoke all on function public.buscar_habilidades_cerca(text, int) from public, anon, authenticated;
grant execute on function public.buscar_habilidades_cerca(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Aviso diario: "Estas disponible hoy para trabajitos?"
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('pedido_cerca', 'mensaje', 'estado_pedido', 'resena', 'sistema', 'encuentro', 'disponibilidad'));

alter table public.notification_prefs add column disponibilidad boolean not null default true;
grant update (disponibilidad) on public.notification_prefs to authenticated;

-- encolar_notificacion (0002) + la preferencia nueva.
create or replace function public.encolar_notificacion(
  p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs notification_prefs;
begin
  select * into prefs from notification_prefs where user_id = p_user;
  if prefs is null then
    return;
  end if;
  if (p_kind = 'pedido_cerca'   and not prefs.pedidos_cerca)
  or (p_kind = 'mensaje'        and not prefs.mensajes)
  or (p_kind = 'estado_pedido'  and not prefs.estado_pedidos)
  or (p_kind = 'resena'         and not prefs.resenas)
  or (p_kind = 'disponibilidad' and not prefs.disponibilidad) then
    return;
  end if;
  insert into notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, p_data);
end
$$;

revoke all on function public.encolar_notificacion(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.avisar_disponibilidad()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  for u in
    select pv.user_id
      from profile_private pv
     where pv.ofrece_servicios
       and (pv.disponible_hasta is null or pv.disponible_hasta <= now())
       and not exists (
         select 1 from notifications n
          where n.user_id = pv.user_id and n.kind = 'disponibilidad'
            and n.created_at > now() - interval '20 hours'
       )
  loop
    perform encolar_notificacion(
      u, 'disponibilidad', 'Estás disponible hoy para trabajitos?',
      'Tocá para avisar y aparecer primero en las búsquedas', jsonb_build_object('disponibilidad', true)
    );
  end loop;
end
$$;

revoke all on function public.avisar_disponibilidad() from public, anon, authenticated;

-- 8:00 de Argentina (11:00 UTC). Solo si el servidor trae pg_cron (en PGlite se saltea).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('cercaya-aviso-disponibilidad', '0 11 * * *', 'select public.avisar_disponibilidad()');
  end if;
exception when others then
  raise notice 'No se pudo programar el aviso de disponibilidad: %', sqlerrm;
end
$$;
