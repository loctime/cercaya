-- =====================================================================
-- Busqueda mas flexible (revision final del modo Trabajo).
--
-- Antes la busqueda exigia que TODAS las palabras estuvieran en la etiqueta o
-- los sinonimos de una misma habilidad: "canilla rota" no encontraba a un
-- Plomero ni a quien escribio "Arreglo canillas" a mano. Ahora se descartan las
-- palabras de relleno (articulos, "rota", "arreglar", "reparacion"...) y se
-- busca por las que quedan. Si no queda ninguna, no se busca nada.
--
-- Tambien se vinculan al catalogo los oficios cargados antes de 0110 cuya
-- etiqueta coincide, para que tengan sinonimos.
-- =====================================================================

create or replace function public.palabras_busqueda(p_texto text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(w), '{}')
    from (
      select distinct w
        from unnest(regexp_split_to_array(trim(normalizar_busqueda(p_texto)), '\s+')) w
       where char_length(w) >= 2
         and w <> all (array[
           'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'mi', 'me', 'para', 'por',
           'con', 'que', 'en', 'y',
           'rota', 'roto', 'rotas', 'rotos', 'arreglar', 'arreglo', 'arreglos', 'reparar', 'reparacion',
           'reparaciones', 'necesito', 'quiero', 'busco', 'urgente'
         ])
    ) s
$$;

revoke all on function public.palabras_busqueda(text) from public, anon, authenticated;

-- Vincular oficios viejos con el catalogo (misma etiqueta, sin tildes ni mayusculas).
update public.oficios o
   set catalog_id = h.id, tipo = h.tipo
  from public.habilidades_catalogo h
 where o.catalog_id is null
   and normalizar_busqueda(o.label) = normalizar_busqueda(h.label);

-- ---------------------------------------------------------------------
-- buscar_servicio (0111) usando palabras_busqueda
-- ---------------------------------------------------------------------
create or replace function public.buscar_servicio(p_texto text, p_radio_km int default 15)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], coincide text, es_contacto boolean, lat float8, lng float8
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
     where auth.uid() is not null
       and pv.ofrece_servicios
       and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days'
       and p.id <> auth.uid()
       and not bloqueado(auth.uid(), p.id)
  )
  select c.id, c.full_name, c.avatar_url, zona_de(c.dlat, c.dlng, c.location_precision),
         distancia_publica(dist_km(yo.lat, yo.lng, c.dlat, c.dlng)),
         coalesce((select array_agg(o.label order by o.label) from (
           select label from oficios where user_id = c.id order by label limit 5) o), '{}'),
         m.label, es_contacto(auth.uid(), c.id), c.dlat, c.dlng
    from candidatos c
    cross join yo
    cross join q
    cross join lateral (
      select o.label
        from oficios o left join habilidades_catalogo h on h.id = o.catalog_id
       where o.user_id = c.id
         and not exists (
           select 1 from unnest(q.palabras) palabra
            where normalizar_busqueda(o.label || ' ' || coalesce(array_to_string(h.aliases, ' '), '')) not like '%' || palabra || '%'
         )
       order by o.label
       limit 1
    ) m
   where dist_km(yo.lat, yo.lng, c.dlat, c.dlng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
   order by dist_km(yo.lat, yo.lng, c.dlat, c.dlng), c.full_name
   limit 30
$$;

revoke all on function public.buscar_servicio(text, int) from public, anon, authenticated;
grant execute on function public.buscar_servicio(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- buscar_habilidades_cerca (0111) usando palabras_busqueda
-- ---------------------------------------------------------------------
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
