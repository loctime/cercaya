-- =====================================================================
-- Usuarios: perfil publico, datos privados, bloqueos, notificaciones.
--
-- Regla de oro: telefono y ubicacion exacta viven en profile_private,
-- que solo lee su duenio. Lo publico (profiles) tiene una ubicacion
-- redondeada (~1 km) y el nombre de la zona.
-- =====================================================================

-- Distancia en km entre dos puntos (Haversine).
create or replace function public.dist_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
as $$
  select 6371 * acos(least(1.0,
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) +
    sin(radians(lat1)) * sin(radians(lat2))
  ))
$$;

-- Zonas conocidas (localidades por ahora; barrios mas adelante).
create table public.zones (
  id        serial primary key,
  name      text not null,
  localidad text not null,
  lat       float8 not null,
  lng       float8 not null
);

-- Nombre de zona para una posicion: la zona mas cercana a menos de 20 km.
create or replace function public.zona_de(p_lat float8, p_lng float8, p_precision text default 'barrio')
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p_precision = 'localidad' then z.localidad else z.name end
       from zones z
      where dist_km(p_lat, p_lng, z.lat, z.lng) <= 20
      order by dist_km(p_lat, p_lng, z.lat, z.lng)
      limit 1),
    'Otra zona')
$$;

-- ---------------------------------------------------------------------
-- Perfil publico
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 80),
  avatar_url  text,
  zone_label  text,
  approx_lat  numeric(6, 2),
  approx_lng  numeric(6, 2),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Datos privados (solo el duenio)
-- ---------------------------------------------------------------------
create table public.profile_private (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  phone               text check (phone is null or phone ~ '^\+?[0-9 ()-]{8,20}$'),
  -- Oculto por defecto (decision Diego 23/09): la app sugiere mostrarlo.
  show_phone          boolean not null default false,
  -- Solo ven el numero usuarios logueados a menos de este radio.
  phone_radius_km     int not null default 30 check (phone_radius_km between 1 and 100),
  location_precision  text not null default 'barrio' check (location_precision in ('barrio', 'localidad')),
  lat                 float8 check (lat between -90 and 90),
  lng                 float8 check (lng between -180 and 180),
  location_updated_at timestamptz
);

-- Mantiene la ubicacion aproximada publica sincronizada con la exacta.
create or replace function public.sync_ubicacion_publica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lat is null or new.lng is null then
    update profiles set approx_lat = null, approx_lng = null, zone_label = null
     where id = new.user_id;
  else
    update profiles
       set approx_lat = round(new.lat::numeric, 2),
           approx_lng = round(new.lng::numeric, 2),
           zone_label = zona_de(new.lat, new.lng, new.location_precision)
     where id = new.user_id;
  end if;
  return new;
end
$$;

create trigger profile_private_sync_ubicacion
after insert or update of lat, lng, location_precision on public.profile_private
for each row execute function public.sync_ubicacion_publica();

-- La app manda la posicion del GPS por aca (o el usuario la ajusta).
create or replace function public.set_mi_ubicacion(p_lat float8, p_lng float8)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesion';
  end if;
  update profile_private
     set lat = p_lat, lng = p_lng, location_updated_at = now()
   where user_id = auth.uid();
end
$$;

-- ---------------------------------------------------------------------
-- Bloqueos
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.bloqueado(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------
-- Notificaciones: preferencias, tokens push y bandeja (outbox).
-- La bandeja sirve para la campanita de la app y como cola para el
-- envio push (lo hace una funcion del servidor que lee sent_at null).
-- ---------------------------------------------------------------------
create table public.notification_prefs (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  pedidos_cerca    boolean not null default true,
  pedidos_radio_km int not null default 15 check (pedidos_radio_km between 1 and 50),
  mensajes         boolean not null default true,
  estado_pedidos   boolean not null default true,
  resenas          boolean not null default true
);

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('pedido_cerca', 'mensaje', 'estado_pedido', 'resena', 'sistema')),
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  sent_at    timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pendientes_idx on public.notifications (created_at) where sent_at is null;

-- Encola una notificacion respetando las preferencias del usuario.
-- Interna: la llaman otras funciones, nunca la app.
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
  if (p_kind = 'pedido_cerca'  and not prefs.pedidos_cerca)
  or (p_kind = 'mensaje'       and not prefs.mensajes)
  or (p_kind = 'estado_pedido' and not prefs.estado_pedidos)
  or (p_kind = 'resena'        and not prefs.resenas) then
    return;
  end if;
  insert into notifications (user_id, kind, title, body, data)
  values (p_user, p_kind, p_title, p_body, p_data);
end
$$;

create or replace function public.marcar_notificaciones_leidas()
returns void
language sql
security definer
set search_path = public
as $$
  update notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
$$;

-- ---------------------------------------------------------------------
-- Alta automatica: al registrarse se crean perfil, datos privados y
-- preferencias. Nombre y celular vienen en los metadatos del signUp.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nombre text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  cel    text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  insert into profiles (id, full_name) values (new.id, coalesce(left(nombre, 80), 'Vecino'));
  insert into profile_private (user_id, phone) values (new.id, cel);
  insert into notification_prefs (user_id) values (new.id);
  return new;
end
$$;

create trigger crear_perfil_al_registrarse
after insert on auth.users
for each row execute function public.crear_perfil_nuevo_usuario();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.zones enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.blocks enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

create policy zones_lectura on public.zones for select using (true);

create policy profiles_lectura on public.profiles for select using (true);
create policy profiles_editar_propio on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy profile_private_propio on public.profile_private for select using (user_id = auth.uid());
create policy profile_private_editar on public.profile_private for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_propios on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_crear on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_borrar on public.blocks for delete using (blocker_id = auth.uid());

create policy prefs_propias on public.notification_prefs for select using (user_id = auth.uid());
create policy prefs_editar on public.notification_prefs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_propios on public.push_tokens for select using (user_id = auth.uid());
create policy push_crear on public.push_tokens for insert with check (user_id = auth.uid());
create policy push_borrar on public.push_tokens for delete using (user_id = auth.uid());

create policy notif_propias on public.notifications for select using (user_id = auth.uid());
