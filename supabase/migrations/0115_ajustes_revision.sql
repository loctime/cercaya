-- =====================================================================
-- Ajustes de la revision de 0113/0114.
--
--  * Se encuentra por el nombre de la persona (tapicero, costurera, peluquera...):
--    la busqueda solo mira etiqueta + sinonimos, no el id.
--  * Un oficio escrito a mano cuya etiqueta coincide con el catalogo se vincula
--    solo (y gana los sinonimos), tambien para los ya cargados.
--  * Se sacan sinonimos que prometen algo que no se puede verificar:
--    "matriculado" (gasista), "enfermera" (cuidado de mayores), "kinesiologo"
--    (masajista).
--  * "Disponible ahora" y el aviso diario exigen que la persona pueda aparecer en
--    una busqueda: alguna habilidad que acepte pedidos y ubicacion de los
--    ultimos 7 dias.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Formas comunes del nombre (femenino, masculino, agente)
-- ---------------------------------------------------------------------
update public.habilidades_catalogo set aliases = aliases || array['tapicero', 'tapicera'] where id = 'tapicero';
update public.habilidades_catalogo set aliases = aliases || array['fumigador', 'fumigadora'] where id = 'fumigador';
update public.habilidades_catalogo set aliases = aliases || array['costurera', 'costurero'] where id = 'costurera';
update public.habilidades_catalogo set aliases = aliases || array['colocador', 'colocadora', 'colocador de pisos'] where id = 'colocador-pisos';
update public.habilidades_catalogo set aliases = aliases || array['fletero', 'fletera'] where id = 'fletes';
update public.habilidades_catalogo set aliases = aliases || array['disenador', 'disenadora', 'disenador grafico'] where id = 'diseno-grafico';
update public.habilidades_catalogo set aliases = aliases || array['peluquero', 'peluquera'] where id = 'peluquero';
update public.habilidades_catalogo set aliases = aliases || array['cocinero', 'cocinera'] where id = 'cocinero';
update public.habilidades_catalogo set aliases = aliases || array['fotografo', 'fotografa'] where id = 'fotografo';
update public.habilidades_catalogo set aliases = aliases || array['herrera'] where id = 'herrero';
update public.habilidades_catalogo set aliases = aliases || array['plomera'] where id = 'plomero';
update public.habilidades_catalogo set aliases = aliases || array['cerrajera'] where id = 'cerrajero';
update public.habilidades_catalogo set aliases = aliases || array['carpintera'] where id = 'carpintero';
update public.habilidades_catalogo set aliases = aliases || array['pintora'] where id = 'pintor';
update public.habilidades_catalogo set aliases = aliases || array['jardinera'] where id = 'jardinero';
update public.habilidades_catalogo set aliases = aliases || array['zinguera'] where id = 'zinguero';
update public.habilidades_catalogo set aliases = aliases || array['gomera'] where id = 'gomero';
update public.habilidades_catalogo set aliases = aliases || array['soldadora'] where id = 'soldador';
update public.habilidades_catalogo set aliases = aliases || array['vidriera'] where id = 'vidriero';
update public.habilidades_catalogo set aliases = aliases || array['piletera'] where id = 'piletero';

-- ---------------------------------------------------------------------
-- Sinonimos que prometian algo que nadie verifica
-- ---------------------------------------------------------------------
update public.habilidades_catalogo set aliases = array_remove(aliases, 'matriculado gas') where id = 'gasista';
update public.habilidades_catalogo set aliases = array_remove(aliases, 'enfermera') where id = 'cuidador-mayores';
update public.habilidades_catalogo set aliases = array_remove(array_remove(aliases, 'kinesiologia'), 'kinesiologo') where id = 'masajista';

-- ---------------------------------------------------------------------
-- Vincular al catalogo los oficios escritos a mano que coinciden (hoy y de ahora en mas)
-- ---------------------------------------------------------------------
update public.oficios o
   set catalog_id = h.id, tipo = h.tipo
  from public.habilidades_catalogo h
 where o.catalog_id is null
   and normalizar_busqueda(o.label) = normalizar_busqueda(h.label);

create or replace function public.vincular_oficio_con_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h habilidades_catalogo;
begin
  if new.catalog_id is null then
    select * into h from habilidades_catalogo
     where normalizar_busqueda(label) = normalizar_busqueda(new.label)
     limit 1;
    if found then
      new.catalog_id := h.id;
      new.tipo := h.tipo;
    end if;
  end if;
  return new;
end
$$;

create trigger oficios_vincula_catalogo
  before insert on public.oficios
  for each row execute function public.vincular_oficio_con_catalogo();

revoke all on function public.vincular_oficio_con_catalogo() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- estoy_disponible (0114): ademas exige una habilidad que acepte pedidos
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
  if not exists (select 1 from oficios where user_id = yo and acepta_pedidos) then
    raise exception 'Prendé al menos una habilidad para poder avisar que estás disponible';
  end if;
  hasta := now() + make_interval(hours => p_horas);
  update profile_private set disponible_hasta = hasta where user_id = yo;
  return hasta;
end
$$;

revoke all on function public.estoy_disponible(int) from public, anon, authenticated;
grant execute on function public.estoy_disponible(int) to authenticated;

-- ---------------------------------------------------------------------
-- avisar_disponibilidad (0114): solo a quien puede aparecer en una busqueda
-- ---------------------------------------------------------------------
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
       and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days'
       and exists (select 1 from oficios o where o.user_id = pv.user_id and o.acepta_pedidos)
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
