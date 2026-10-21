-- =====================================================================
-- Modo encuentro ("Voy para alla"): dos contactos comparten ubicacion exacta
-- en vivo, solo entre ellos, mientras el encuentro esta activo.
--
-- La posicion exacta vive en encounter_positions y SOLO la devuelve
-- encuentro_sync(), a su contraparte, con el encuentro activo. Las tablas no
-- tienen permisos directos. Al terminar por cualquier via se borran las
-- posiciones.
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('pedido_cerca', 'mensaje', 'estado_pedido', 'resena', 'sistema', 'encuentro'));

create table public.encounters (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pendiente'
               check (status in ('pendiente', 'activo', 'terminado', 'rechazado', 'vencido')),
  minutos      int not null check (minutos in (60, 120)),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  ends_at      timestamptz,
  ended_at     timestamptz,
  ended_by     uuid references public.profiles(id) on delete set null,
  check (requester_id <> addressee_id)
);

-- Un solo encuentro abierto entre dos personas, en cualquier sentido.
create unique index encounters_abierto_unico
  on public.encounters (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pendiente', 'activo');

create table public.encounter_positions (
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  lat          float8 not null check (lat between -90 and 90),
  lng          float8 not null check (lng between -180 and 180),
  updated_at   timestamptz not null default now(),
  primary key (encounter_id, user_id)
);

alter table public.encounters enable row level security;
alter table public.encounter_positions enable row level security;

-- ---------------------------------------------------------------------
-- Internas
-- ---------------------------------------------------------------------
create or replace function public.cerrar_encuentro(p_id uuid, p_estado text, p_por uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update encounters set status = p_estado, ended_at = now(), ended_by = p_por where id = p_id;
  delete from encounter_positions where encounter_id = p_id;
end
$$;

-- Cierra los activos que vencieron y las solicitudes sin respuesta (15 min).
create or replace function public.cerrar_vencidos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from encounter_positions
   where encounter_id in (select id from encounters where status = 'activo' and ends_at <= now());
  update encounters set status = 'terminado', ended_at = now()
   where status = 'activo' and ends_at <= now();
  update encounters set status = 'vencido', ended_at = now()
   where status = 'pendiente' and created_at < now() - interval '15 minutes';
end
$$;

-- ---------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------
create or replace function public.pedir_encuentro(p_destino uuid, p_minutos int default 120)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo     uuid := auth.uid();
  quien  text;
  nuevo  uuid;
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  if p_minutos not in (60, 120) then raise exception 'Los minutos tienen que ser 60 o 120'; end if;
  if bloqueado(yo, p_destino) then raise exception 'No se puede pedir el encuentro'; end if;
  if not es_contacto(yo, p_destino) then raise exception 'Solo podes pedirle a un contacto'; end if;

  perform cerrar_vencidos();
  if (select count(*) from encounters where requester_id = yo and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Limite diario de encuentros';
  end if;

  -- serializa los dos sentidos si llegan a la vez
  perform pg_advisory_xact_lock(hashtext(least(yo::text, p_destino::text) || greatest(yo::text, p_destino::text)));
  if exists (
    select 1 from encounters
     where status in ('pendiente', 'activo')
       and ((requester_id = yo and addressee_id = p_destino) or (requester_id = p_destino and addressee_id = yo))
  ) then
    raise exception 'Ya hay un encuentro abierto con esta persona';
  end if;

  insert into encounters (requester_id, addressee_id, minutos) values (yo, p_destino, p_minutos)
  returning id into nuevo;

  select full_name into quien from profiles where id = yo;
  perform encolar_notificacion(p_destino, 'encuentro', quien || ' va para allá',
                               'Tocá para aceptar y ver dónde está', jsonb_build_object('encounter_id', nuevo));
  return nuevo;
end
$$;

create or replace function public.responder_encuentro(p_id uuid, p_acepta boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  e     encounters;
  quien text;
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  perform cerrar_vencidos();
  select * into e from encounters x where x.id = p_id and x.addressee_id = yo and x.status = 'pendiente' for update;
  if not found then raise exception 'No podes responder este encuentro'; end if;

  if not p_acepta then
    perform cerrar_encuentro(p_id, 'rechazado', yo);
    return;
  end if;
  if bloqueado(e.requester_id, e.addressee_id) or not es_contacto(e.requester_id, e.addressee_id) then
    perform cerrar_encuentro(p_id, 'rechazado', yo);
    raise exception 'No podes responder este encuentro';
  end if;

  update encounters
     set status = 'activo', accepted_at = now(), ends_at = now() + make_interval(mins => e.minutos)
   where id = p_id;
  select full_name into quien from profiles where id = yo;
  perform encolar_notificacion(e.requester_id, 'encuentro', quien || ' aceptó',
                               'Ya pueden verse en el mapa', jsonb_build_object('encounter_id', p_id));
end
$$;

create or replace function public.terminar_encuentro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  if not exists (
    select 1 from encounters x
     where x.id = p_id and yo in (x.requester_id, x.addressee_id) and x.status in ('pendiente', 'activo')
  ) then
    raise exception 'No podes terminar este encuentro';
  end if;
  perform cerrar_encuentro(p_id, 'terminado', yo);
end
$$;

-- Encuentros abiertos mios: solicitudes sin vencer y activos.
create or replace function public.mis_encuentros()
returns table (
  id              uuid,
  estado          text,
  soy_solicitante boolean,
  otro_id         uuid,
  otro_nombre     text,
  otro_avatar     text,
  ends_at         timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cerrar_vencidos();
  return query
    select e.id, e.status, e.requester_id = auth.uid(), o.id, o.full_name, o.avatar_url, e.ends_at
      from encounters e
      join profiles o on o.id = case when e.requester_id = auth.uid() then e.addressee_id else e.requester_id end
     where auth.uid() is not null
       and auth.uid() in (e.requester_id, e.addressee_id)
       and e.status in ('pendiente', 'activo')
       and not bloqueado(e.requester_id, e.addressee_id)
     order by e.created_at desc;
end
$$;

-- Guarda mi posicion y devuelve la del otro. Con el encuentro activo es la
-- unica via por la que sale una posicion exacta.
create or replace function public.encuentro_sync(p_id uuid, p_lat float8, p_lng float8)
returns table (
  estado       text,
  ends_at      timestamptz,
  otro_lat     float8,
  otro_lng     float8,
  otro_at      timestamptz,
  distancia_m  float8,
  llegaron     boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  e     encounters;
  otro  uuid;
  po    encounter_positions;
  d     float8;
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  perform cerrar_vencidos();
  select * into e from encounters x where x.id = p_id and yo in (x.requester_id, x.addressee_id) for update;
  if not found then raise exception 'No sos parte de este encuentro'; end if;

  if e.status in ('pendiente', 'activo')
     and (bloqueado(e.requester_id, e.addressee_id) or not es_contacto(e.requester_id, e.addressee_id)) then
    perform cerrar_encuentro(e.id, 'terminado', yo);
    e.status := 'terminado';
  end if;

  if e.status <> 'activo' then
    if e.status <> 'pendiente' then
      delete from encounter_positions where encounter_id = e.id;
    end if;
    return query select e.status, e.ends_at, null::float8, null::float8, null::timestamptz, null::float8, false;
    return;
  end if;

  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Posicion invalida';
  end if;
  insert into encounter_positions (encounter_id, user_id, lat, lng, updated_at)
  values (e.id, yo, p_lat, p_lng, now())
  on conflict (encounter_id, user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();

  otro := case when e.requester_id = yo then e.addressee_id else e.requester_id end;
  select * into po from encounter_positions where encounter_id = e.id and user_id = otro;
  if not found then
    return query select e.status, e.ends_at, null::float8, null::float8, null::timestamptz, null::float8, false;
    return;
  end if;

  d := dist_km(p_lat, p_lng, po.lat, po.lng) * 1000;
  return query select e.status, e.ends_at, po.lat, po.lng, po.updated_at, d,
                      (d <= 50 and po.updated_at > now() - interval '2 minutes');
end
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on table public.encounters, public.encounter_positions from public, anon, authenticated;
revoke all on function public.cerrar_encuentro(uuid, text, uuid), public.cerrar_vencidos() from public, anon, authenticated;
revoke all on function
  public.pedir_encuentro(uuid, int), public.responder_encuentro(uuid, boolean), public.terminar_encuentro(uuid),
  public.mis_encuentros(), public.encuentro_sync(uuid, float8, float8)
  from public, anon, authenticated;
grant execute on function
  public.pedir_encuentro(uuid, int), public.responder_encuentro(uuid, boolean), public.terminar_encuentro(uuid),
  public.mis_encuentros(), public.encuentro_sync(uuid, float8, float8)
  to authenticated;

-- Limpieza programada: no depende de que alguien abra la app. Solo si el
-- servidor trae pg_cron (en PGlite se saltea, igual que pg_net en 0011).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('cercaya-cerrar-encuentros', '*/10 * * * *', 'select public.cerrar_vencidos()');
  end if;
exception when others then
  raise notice 'No se pudo programar la limpieza de encuentros: %', sqlerrm;
end
$$;
