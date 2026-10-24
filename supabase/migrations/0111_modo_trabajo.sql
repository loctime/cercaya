-- =====================================================================
-- Modo Trabajo: buscador de servicios en el mapa.
--
--  * "Ofrezco servicios": quien lo activa aparece en las busquedas de Trabajo
--    (independiente de es_publico).
--  * buscar_servicio(): busca por habilidad (con sinonimos del catalogo 0110),
--    incluye contactos y siempre devuelve la ubicacion difuminada.
--  * Tope de chats nuevos por dia con desconocidos.
--  * Arregla buscar_habilidades_cerca (0110): separaba las palabras por una
--    barra invertida literal ('\\s+' dentro de $$) y un texto como "?" devolvia
--    a todos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ofrezco servicios
-- ---------------------------------------------------------------------
alter table public.profile_private
  add column ofrece_servicios boolean not null default false;

grant update (ofrece_servicios) on public.profile_private to authenticated;

-- No se puede activar sin tener al menos una habilidad cargada.
create or replace function public.validar_ofrece_servicios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ofrece_servicios and not exists (select 1 from oficios where user_id = new.user_id) then
    raise exception 'Cargá al menos una habilidad para ofrecer servicios';
  end if;
  return new;
end
$$;

create trigger profile_private_valida_ofrece
  before update of ofrece_servicios on public.profile_private
  for each row when (new.ofrece_servicios)
  execute function public.validar_ofrece_servicios();

-- Al borrar la ultima habilidad se apaga solo.
create or replace function public.apagar_ofrece_si_sin_habilidades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from oficios where user_id = old.user_id) then
    update profile_private set ofrece_servicios = false
     where user_id = old.user_id and ofrece_servicios;
  end if;
  return null;
end
$$;

create trigger oficios_apaga_ofrece
  after delete on public.oficios
  for each row execute function public.apagar_ofrece_si_sin_habilidades();

revoke all on function public.validar_ofrece_servicios(), public.apagar_ofrece_si_sin_habilidades()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Sinonimos que faltaban ("canilla rota", "reparacion canilla"...).
-- La busqueda exige que TODAS las palabras esten en la etiqueta o en los sinonimos.
-- ---------------------------------------------------------------------
update public.habilidades_catalogo set aliases = aliases || array[
  'canilla rota', 'reparar canilla', 'reparacion canilla', 'reparacion de canilla', 'canilla gotea', 'arreglo de canilla'
] where id = 'arreglar-canilla';

update public.habilidades_catalogo set aliases = aliases || array[
  'desague tapado', 'pileta tapada', 'bacha tapada', 'reparar desague', 'caneria tapada'
] where id = 'destapar-desague';

update public.habilidades_catalogo set aliases = aliases || array[
  'lampara quemada', 'foco quemado', 'bombilla quemada', 'cambiar luz', 'arreglar luz'
] where id = 'cambiar-lamparita';

update public.habilidades_catalogo set aliases = aliases || array[
  'arreglar luz', 'reparar luz', 'reparacion electrica', 'arreglar enchufe', 'reparar enchufe', 'corte de luz', 'cortocircuito'
] where id = 'electricista';

update public.habilidades_catalogo set aliases = aliases || array[
  'arreglar canilla', 'reparar caneria', 'reparacion de plomeria', 'perdida de agua', 'destapar desague', 'termotanque'
] where id = 'plomero';

update public.habilidades_catalogo set aliases = aliases || array[
  'reparar pared', 'pintar casa', 'pintar habitacion', 'pintura de paredes'
] where id in ('pintor', 'pintar-pared');

update public.habilidades_catalogo set aliases = aliases || array[
  'reparar pared', 'arreglar techo', 'arreglar vereda', 'levantar pared', 'reparacion de pared'
] where id in ('albanil', 'arreglos-albanileria');

-- ---------------------------------------------------------------------
-- buscar_servicio: Trabajo
-- ---------------------------------------------------------------------
create or replace function public.buscar_servicio(p_texto text, p_radio_km int default 15)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], coincide text, es_contacto boolean, lat float8, lng float8
)
language sql stable security definer set search_path = public as $$
  with q as (
    -- Texto que normaliza a menos de 2 letras (espacios, signos, "%", "_") no busca nada.
    select regexp_split_to_array(trim(normalizar_busqueda(p_texto)), '\s+') palabras
     where char_length(trim(normalizar_busqueda(p_texto))) >= 2
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
-- Arreglo de buscar_habilidades_cerca (0110): separa por espacios de verdad y
-- no devuelve nada con texto vacio.
-- ---------------------------------------------------------------------
create or replace function public.buscar_habilidades_cerca(p_texto text, p_radio_km int default 15)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], estado text, lat float8, lng float8
)
language sql stable security definer set search_path = public as $$
  with q as (
    select regexp_split_to_array(trim(normalizar_busqueda(p_texto)), '\s+') palabras
     where char_length(trim(normalizar_busqueda(p_texto))) >= 2
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

-- ---------------------------------------------------------------------
-- abrir_chat con tope diario hacia desconocidos (copia de 0004 + el tope).
-- Contactos y reabrir una conversacion existente no cuentan.
-- ---------------------------------------------------------------------
create or replace function public.abrir_chat(p_other uuid, p_job uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo  uuid := auth.uid();
  a   uuid := least(yo, p_other);
  b   uuid := greatest(yo, p_other);
  job jobs;
  cid uuid;
begin
  if yo is null then
    raise exception 'Necesitas iniciar sesion';
  end if;
  if p_other = yo or not exists (select 1 from profiles where id = p_other) then
    raise exception 'Usuario invalido';
  end if;
  if bloqueado(yo, p_other) then
    raise exception 'No podes chatear con este usuario';
  end if;
  if p_job is not null then
    select * into job from jobs where id = p_job;
    if job is null or job.client_id not in (yo, p_other) then
      raise exception 'Pedido invalido';
    end if;
  end if;

  select id into cid from conversations
   where user_a = a and user_b = b
     and coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_job, '00000000-0000-0000-0000-000000000000'::uuid);

  if cid is not null then
    update conversations
       set hidden_a = case when yo = user_a then false else hidden_a end,
           hidden_b = case when yo = user_b then false else hidden_b end
     where id = cid;
    return cid;
  end if;

  -- Tope diario de chats nuevos con gente que no es contacto.
  if not es_contacto(yo, p_other) and (
       select count(*) from conversations c
        where c.created_by = yo
          and c.created_at > now() - interval '24 hours'
          and not es_contacto(yo, case when c.user_a = yo then c.user_b else c.user_a end)
     ) >= 10 then
    raise exception 'Llegaste al limite de chats nuevos de hoy';
  end if;

  if (select count(*) from conversations
       where created_by = yo and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Abriste demasiados chats en poco tiempo';
  end if;

  insert into conversations (job_id, user_a, user_b, created_by)
  values (p_job, a, b, yo)
  returning id into cid;

  insert into contact_events (actor_id, target_id, kind, job_id) values (yo, p_other, 'chat', p_job);
  return cid;
end
$$;

revoke all on function public.abrir_chat(uuid, uuid) from public, anon, authenticated;
grant execute on function public.abrir_chat(uuid, uuid) to authenticated;
