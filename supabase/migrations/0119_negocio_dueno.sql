-- =====================================================================
-- El dueño de un negocio reclamado: editarlo, ocultarlo y verlo aunque
-- este oculto. Y si borra su cuenta, el negocio no queda "reclamado"
-- sin dueño: queda oculto hasta que lo revise un admin.
-- =====================================================================

create or replace function public.editar_mi_negocio(
  p_negocio uuid, p_nombre text default null, p_bio text default null, p_telefono text default null,
  p_tipo text default null, p_lat float8 default null, p_lng float8 default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from negocios where id = p_negocio and owner_id = auth.uid()) then
    raise exception 'Este negocio no es tuyo';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'La ubicación necesita latitud y longitud';
  end if;
  update negocios set
    nombre   = coalesce(nullif(trim(p_nombre), ''), nombre),
    bio      = case when p_bio is null then bio else nullif(trim(p_bio), '') end,
    telefono = case when p_telefono is null then telefono else nullif(trim(p_telefono), '') end,
    tipo     = coalesce(p_tipo, tipo),
    lat      = coalesce(p_lat, lat),
    lng      = coalesce(p_lng, lng),
    updated_at = now()
  where id = p_negocio;
end
$$;

create or replace function public.ocultar_mi_negocio(p_negocio uuid, p_oculto boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  neg negocios;
begin
  select * into neg from negocios where id = p_negocio and owner_id = auth.uid() for update;
  if neg.id is null then
    raise exception 'Este negocio no es tuyo';
  end if;
  if p_oculto then
    if neg.estado = 'reclamado' then
      update negocios set estado = 'oculto', motivo_oculto = 'dueno', updated_at = now() where id = p_negocio;
    end if;
  elsif neg.estado = 'oculto' then
    if neg.motivo_oculto is distinct from 'dueno' then
      raise exception 'Lo ocultó el equipo de CercaYa. Escribinos a cercaya@controlapps.ar';
    end if;
    update negocios set estado = 'reclamado', motivo_oculto = null, updated_at = now() where id = p_negocio;
  end if;
end
$$;

create or replace function public.mis_negocios()
returns table (
  id uuid, nombre text, bio text, telefono text, tipo text, lat float8, lng float8,
  estado text, motivo_oculto text
)
language sql stable security definer set search_path = public as $$
  select n.id, n.nombre, n.bio, n.telefono, n.tipo, n.lat, n.lng, n.estado, n.motivo_oculto
    from negocios n
   where n.owner_id = auth.uid()
   order by n.nombre
$$;

create or replace function public.negocios_owner_borrado()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null and old.owner_id is not null and old.estado = 'reclamado' then
    new.estado := 'oculto';
    new.motivo_oculto := 'cuenta';
  end if;
  return new;
end
$$;

create trigger negocios_owner_borrado
before update of owner_id on public.negocios
for each row execute function public.negocios_owner_borrado();

revoke all on function public.negocios_owner_borrado() from public, anon, authenticated;
revoke all on function public.editar_mi_negocio(uuid, text, text, text, text, float8, float8),
  public.ocultar_mi_negocio(uuid, boolean), public.mis_negocios()
  from public, anon, authenticated;
grant execute on function public.editar_mi_negocio(uuid, text, text, text, text, float8, float8),
  public.ocultar_mi_negocio(uuid, boolean), public.mis_negocios()
  to authenticated;
