-- =====================================================================
-- Prestadores: cualquier usuario puede ofrecer servicios. Aparece en el
-- catalogo recien cuando un admin lo aprueba (decision Diego 23/09).
-- =====================================================================

create table public.categories (
  id        serial primary key,
  slug      text not null unique,
  name      text not null,
  icon      text not null,          -- nombre del icono vectorial (lucide)
  sort      int not null default 0,
  is_active boolean not null default true
);

create table public.provider_profiles (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  bio                text check (char_length(bio) <= 1000),
  price_range        text check (char_length(price_range) <= 120),
  coverage_radius_km int not null default 15 check (coverage_radius_km between 1 and 30),
  status             text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'suspendido')),
  is_active          boolean not null default true,   -- el prestador puede pausarse
  approved_at        timestamptz,
  created_at         timestamptz not null default now()
);

create table public.provider_services (
  user_id     uuid not null references public.provider_profiles(user_id) on delete cascade,
  category_id int not null references public.categories(id) on delete cascade,
  primary key (user_id, category_id)
);

create table public.provider_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.provider_profiles(user_id) on delete cascade,
  storage_path text not null,
  caption      text check (char_length(caption) <= 200),
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create or replace function public.limitar_fotos_galeria()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from provider_photos where user_id = new.user_id) >= 6 then
    raise exception 'La galeria admite hasta 6 fotos';
  end if;
  return new;
end
$$;

create trigger provider_photos_limite
before insert on public.provider_photos
for each row execute function public.limitar_fotos_galeria();

-- Visible en el catalogo = aprobado y activo.
create or replace function public.prestador_visible(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from provider_profiles
     where user_id = p_user and status = 'aprobado' and is_active
  )
$$;

-- ---------------------------------------------------------------------
-- Registro de eventos de contacto: alimenta metricas del prestador y
-- sirve de evidencia antifraude. La app no lo lee directo.
-- ---------------------------------------------------------------------
create table public.contact_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('ver_perfil', 'whatsapp', 'revelar_telefono', 'chat', 'compartir_contacto')),
  job_id     uuid,
  created_at timestamptz not null default now()
);

create index contact_events_target_idx on public.contact_events (target_id, kind);

-- Lo que la app registra por su cuenta: ver un perfil y tocar WhatsApp.
-- Un mismo evento del mismo usuario cuenta una vez por hora.
create or replace function public.registrar_evento(p_target uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = p_target then
    return;
  end if;
  if p_kind not in ('ver_perfil', 'whatsapp') then
    raise exception 'Evento no permitido';
  end if;
  if exists (
    select 1 from contact_events
     where actor_id = auth.uid() and target_id = p_target and kind = p_kind
       and created_at > now() - interval '1 hour'
  ) then
    return;
  end if;
  insert into contact_events (actor_id, target_id, kind) values (auth.uid(), p_target, p_kind);
end
$$;

-- ---------------------------------------------------------------------
-- Admin: aprobar / suspender prestadores.
-- ---------------------------------------------------------------------
create or replace function public.admin_estado_prestador(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if p_status not in ('pendiente', 'aprobado', 'suspendido') then
    raise exception 'Estado invalido';
  end if;
  update provider_profiles
     set status = p_status,
         approved_at = case when p_status = 'aprobado' then now() else approved_at end
   where user_id = p_user;
  if not found then
    raise exception 'Prestador inexistente';
  end if;
  if p_status = 'aprobado' then
    perform encolar_notificacion(p_user, 'sistema', 'Ya estas en CercaYa',
      'Tu perfil de prestador fue aprobado y ya aparece en el catalogo.', '{}'::jsonb);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_photos enable row level security;
alter table public.contact_events enable row level security;

create policy categories_lectura on public.categories for select using (is_active);

create policy provider_profiles_lectura on public.provider_profiles for select
  using ((status = 'aprobado' and is_active) or user_id = auth.uid() or es_admin());
create policy provider_profiles_crear on public.provider_profiles for insert
  with check (user_id = auth.uid());
create policy provider_profiles_editar on public.provider_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy provider_services_lectura on public.provider_services for select
  using (prestador_visible(user_id) or user_id = auth.uid() or es_admin());
create policy provider_services_crear on public.provider_services for insert
  with check (user_id = auth.uid());
create policy provider_services_borrar on public.provider_services for delete
  using (user_id = auth.uid());

create policy provider_photos_lectura on public.provider_photos for select
  using (prestador_visible(user_id) or user_id = auth.uid() or es_admin());
create policy provider_photos_crear on public.provider_photos for insert
  with check (user_id = auth.uid());
create policy provider_photos_editar on public.provider_photos for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy provider_photos_borrar on public.provider_photos for delete
  using (user_id = auth.uid());

-- contact_events: sin policies = nadie lo lee desde la app.
