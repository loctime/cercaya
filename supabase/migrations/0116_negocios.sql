-- =====================================================================
-- Negocios reclamables (15/11/2026). Perfiles de negocios cargados por
-- nosotros desde Instagram, sin usuario. Un dueño los reclama despues
-- (0117) y cualquiera puede pedir la baja (0118).
-- Diseno: docs/superpowers/specs/2026-11-15-negocios-reclamables-design.md
-- Las tablas no tienen permisos: todo pasa por funciones.
-- =====================================================================

create table public.negocios (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(nombre) between 2 and 80),
  catalog_id       text not null references public.habilidades_catalogo(id),
  bio              text check (char_length(bio) <= 300),
  instagram_usuario text not null unique check (instagram_usuario ~ '^[a-z0-9._]{1,30}$'),
  ig_user_id       text,
  tipo             text not null check (tipo in ('local', 'a_domicilio')),
  lat              float8 not null check (lat between -90 and 90),
  lng              float8 not null check (lng between -180 and 180),
  telefono         text check (char_length(telefono) <= 30),
  estado           text not null default 'sin_reclamar' check (estado in ('sin_reclamar', 'reclamado', 'oculto')),
  motivo_oculto    text check (motivo_oculto in ('baja', 'dueno', 'admin', 'cuenta')),
  owner_id         uuid references public.profiles(id) on delete set null,
  cargado_por      uuid references public.profiles(id) on delete set null,
  fuente           text not null default 'instagram',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index negocios_estado_idx on public.negocios (estado);
create index negocios_owner_idx on public.negocios (owner_id) where owner_id is not null;

alter table public.negocios enable row level security;
revoke all on public.negocios from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- cargar_negocio: lo usa el script de carga (como superusuario, sin
-- sesion) y un admin desde la app.
-- ---------------------------------------------------------------------
create or replace function public.cargar_negocio(
  p_nombre text, p_catalog_id text, p_instagram text, p_tipo text,
  p_lat float8, p_lng float8, p_telefono text default null, p_bio text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  usuario text := lower(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''));
  nuevo uuid;
begin
  if auth.uid() is not null and not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if exists (select 1 from negocios where instagram_usuario = usuario) then
    raise exception 'Ya existe un negocio con ese Instagram';
  end if;
  insert into negocios (nombre, catalog_id, instagram_usuario, tipo, lat, lng, telefono, bio, cargado_por)
  values (trim(p_nombre), p_catalog_id, usuario, p_tipo, p_lat, p_lng,
          nullif(trim(coalesce(p_telefono, '')), ''), nullif(trim(coalesce(p_bio, '')), ''), auth.uid())
  returning id into nuevo;
  return nuevo;
end
$$;

revoke all on function public.cargar_negocio(text, text, text, text, float8, float8, text, text) from public, anon, authenticated;
grant execute on function public.cargar_negocio(text, text, text, text, float8, float8, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- negocios_cerca: los negocios visibles que coinciden con lo que busca
-- el usuario. Local = pin y telefono reales; a domicilio = ubicacion
-- difuminada (~1,6 km, igual que la capa publica) y sin telefono.
-- ---------------------------------------------------------------------
create or replace function public.negocios_cerca(p_texto text, p_radio_km int default 15)
returns table (
  id uuid, nombre text, rubro text, bio text, instagram_usuario text, tipo text,
  telefono text, estado text, distancia_km numeric, lat float8, lng float8, es_mio boolean
)
language sql stable security definer set search_path = public as $$
  with q as (
    select palabras_busqueda(p_texto) palabras
     where cardinality(palabras_busqueda(p_texto)) > 0
  ), yo as (
    select lat, lng from profile_private where user_id = auth.uid() and lat is not null and lng is not null
  ), c as (
    select n.id, n.nombre, h.label rubro, n.bio, n.instagram_usuario, n.tipo, n.estado, n.owner_id,
           case when n.tipo = 'local' then n.telefono end telefono,
           case when n.tipo = 'local' then n.lat else d.lat end plat,
           case when n.tipo = 'local' then n.lng else d.lng end plng,
           normalizar_busqueda(n.nombre || ' ' || h.label || ' ' || array_to_string(h.aliases, ' ')) texto
      from negocios n
      join habilidades_catalogo h on h.id = n.catalog_id
      cross join lateral difuminar(n.lat, n.lng, n.id, 0.015) d
     where auth.uid() is not null
       and n.estado in ('sin_reclamar', 'reclamado')
  )
  select c.id, c.nombre, c.rubro, c.bio, c.instagram_usuario, c.tipo, c.telefono, c.estado,
         distancia_publica(dist_km(yo.lat, yo.lng, c.plat, c.plng)),
         c.plat, c.plng, coalesce(c.owner_id = auth.uid(), false)
    from c
    cross join yo
    cross join q
   where not exists (
           select 1 from unnest(q.palabras) palabra where c.texto not like '%' || palabra || '%'
         )
     and dist_km(yo.lat, yo.lng, c.plat, c.plng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
   order by dist_km(yo.lat, yo.lng, c.plat, c.plng), c.nombre
   limit 30
$$;

revoke all on function public.negocios_cerca(text, int) from public, anon, authenticated;
grant execute on function public.negocios_cerca(text, int) to authenticated;
