-- =====================================================================
-- Ajustes de la revision final de negocios:
--  1. Devolver una baja al mapa no deshace un ocultamiento hecho por el
--     equipo o por el dueño, y ocultar por mail cierra las bajas abiertas.
--  2. Si el dueño borra su cuenta, el negocio queda oculto Y en la cola
--     de bajas para que un admin decida (antes solo si estaba reclamado).
--  3. negocios_cerca respeta los bloqueos, como el resto de las busquedas.
--  4. admin_negocios: buscar un negocio para ocultarlo a mano (pedidos
--     que llegan por mail o por DM).
-- =====================================================================

-- 1) -----------------------------------------------------------------
create or replace function public.admin_resolver_baja(p_baja uuid, p_confirma boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b negocio_bajas;
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  select * into b from negocio_bajas where id = p_baja for update;
  if b.id is null or b.estado = 'revertida' then
    raise exception 'Esa baja ya fue resuelta';
  end if;

  if p_confirma then
    if b.estado <> 'pendiente' then
      raise exception 'Esa baja ya fue resuelta';
    end if;
    update negocio_bajas set estado = 'confirmada', resuelto_por = auth.uid(), resuelto_en = now() where id = b.id;
  else
    update negocio_bajas set estado = 'revertida', resuelto_por = auth.uid(), resuelto_en = now() where id = b.id;
    -- Solo se devuelve al mapa si el negocio sigue oculto por el motivo de ESTA baja.
    update negocios
       set estado = case when owner_id is null then 'sin_reclamar' else 'reclamado' end,
           motivo_oculto = null, updated_at = now()
     where id = b.negocio_id and estado = 'oculto'
       and ((b.user_id is not null and motivo_oculto = 'baja')
         or (b.user_id is null and motivo_oculto in ('admin', 'cuenta')));
  end if;
end
$$;

create or replace function public.admin_ocultar_negocio(p_negocio uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if not exists (select 1 from negocios where id = p_negocio) then
    raise exception 'No encontramos ese negocio';
  end if;
  update negocios set estado = 'oculto', motivo_oculto = 'admin', updated_at = now() where id = p_negocio;
  -- Las bajas que estaban esperando quedan resueltas: el negocio ya esta oculto por decision del equipo.
  update negocio_bajas set estado = 'confirmada', resuelto_por = auth.uid(), resuelto_en = now()
   where negocio_id = p_negocio and estado = 'pendiente';
  insert into negocio_bajas (negocio_id, user_id, motivo, estado, resuelto_por, resuelto_en)
  values (p_negocio, null, nullif(trim(coalesce(p_motivo, '')), ''), 'confirmada', auth.uid(), now());
end
$$;

-- 2) -----------------------------------------------------------------
create or replace function public.negocios_owner_borrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null and old.owner_id is not null then
    new.estado := 'oculto';
    new.motivo_oculto := 'cuenta';
    insert into negocio_bajas (negocio_id, user_id, motivo, estado)
    values (old.id, null, 'El dueño borró su cuenta', 'pendiente');
  end if;
  return new;
end
$$;

-- 3) -----------------------------------------------------------------
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
       and not (n.owner_id is not null and bloqueado(auth.uid(), n.owner_id))
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

-- 4) -----------------------------------------------------------------
create or replace function public.admin_negocios(p_texto text)
returns table (id uuid, nombre text, instagram_usuario text, estado text, motivo_oculto text)
language plpgsql stable security definer set search_path = public as $$
declare
  buscado text := normalizar_busqueda(regexp_replace(trim(coalesce(p_texto, '')), '^@', ''));
  insta text := lower(regexp_replace(trim(coalesce(p_texto, '')), '^@', ''));
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if char_length(trim(buscado)) < 2 then
    return;
  end if;
  return query
    select n.id, n.nombre, n.instagram_usuario, n.estado, n.motivo_oculto
      from negocios n
     where normalizar_busqueda(n.nombre) like '%' || trim(buscado) || '%'
        or n.instagram_usuario like '%' || insta || '%'
     order by n.nombre
     limit 30;
end
$$;

revoke all on function public.negocios_owner_borrado() from public, anon, authenticated;
revoke all on function public.admin_negocios(text) from public, anon, authenticated;
grant execute on function public.admin_negocios(text) to authenticated;
