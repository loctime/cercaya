-- =====================================================================
-- Consultas que usa la app. Calculan distancias con las ubicaciones
-- exactas pero devuelven solo distancias redondeadas: nunca coordenadas
-- de otra persona.
-- =====================================================================

-- Centro de Ramallo: origen por defecto si no hay ubicacion.
create or replace function public.origen_busqueda(p_lat float8, p_lng float8)
returns table (lat float8, lng float8)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_lat, pv.lat, -33.4833), coalesce(p_lng, pv.lng, -60.0167)
    from (select 1) x
    left join profile_private pv on pv.user_id = auth.uid() and p_lat is null
$$;

-- Distancia para mostrar: 0 = "menos de 1 km"; si no, redondeada a 0,5 km.
create or replace function public.distancia_publica(d float8)
returns numeric
language sql
immutable
as $$
  select case when d < 1 then 0 else round((d * 2)::numeric) / 2 end
$$;

create or replace function public.buscar_prestadores(
  p_categoria int default null,
  p_texto     text default null,
  p_orden     text default 'cercania',   -- 'cercania' | 'calificacion'
  p_lat       float8 default null,        -- invitados: posicion del GPS (no se guarda)
  p_lng       float8 default null,
  p_radio_km  int default 30,
  p_limite    int default 50,
  p_offset    int default 0
)
returns table (
  user_id             uuid,
  full_name           text,
  avatar_url          text,
  zone_label          text,
  categorias          int[],
  price_range         text,
  distancia_km        numeric,
  calificacion        numeric,
  cant_resenas        bigint,
  trabajos_realizados bigint,
  contacto            text
)
language sql
stable
security definer
set search_path = public
as $$
  with origen as (select * from origen_busqueda(p_lat, p_lng)),
  norm as (
    select translate(lower(trim(coalesce(p_texto, ''))), 'áéíóúüñ', 'aeiouun') as q
  ),
  base as (
    select pp.user_id, p.full_name, p.avatar_url, p.zone_label, pp.price_range, pp.bio,
           pv.show_phone,
           dist_km(o.lat, o.lng, pv.lat, pv.lng) as d
      from provider_profiles pp
      join profiles p on p.id = pp.user_id
      join profile_private pv on pv.user_id = pp.user_id
      cross join origen o
     where pp.status = 'aprobado' and pp.is_active
       and pv.lat is not null
       and pp.user_id is distinct from auth.uid()
       and (auth.uid() is null or not bloqueado(auth.uid(), pp.user_id))
       and dist_km(o.lat, o.lng, pv.lat, pv.lng) <= least(pp.coverage_radius_km, p_radio_km)
  ),
  con_datos as (
    select b.*,
           array(select ps.category_id from provider_services ps
                  where ps.user_id = b.user_id order by ps.category_id) as cats,
           (select round(avg(r.rating)::numeric, 1) from reviews r
             where r.reviewee_id = b.user_id and r.rol_calificado = 'prestador') as rating,
           (select count(*) from reviews r
             where r.reviewee_id = b.user_id and r.rol_calificado = 'prestador') as n_resenas,
           (select count(*) from jobs j
             where j.assigned_provider_id = b.user_id and j.status = 'cerrado') as n_trabajos
      from base b
  )
  select c.user_id, c.full_name, c.avatar_url, c.zone_label, c.cats, c.price_range,
         distancia_publica(c.d), c.rating, c.n_resenas, c.n_trabajos,
         case when c.show_phone then 'whatsapp' else 'chat' end
    from con_datos c, norm n
   where cardinality(c.cats) > 0
     and (p_categoria is null or p_categoria = any(c.cats))
     and (n.q = '' or
          translate(lower(c.full_name || ' ' || coalesce(c.bio, '')), 'áéíóúüñ', 'aeiouun') like '%' || n.q || '%'
          or exists (select 1 from categories cat
                      where cat.id = any(c.cats)
                        and translate(lower(cat.name), 'áéíóúüñ', 'aeiouun') like '%' || n.q || '%'))
   order by
     case when p_orden = 'calificacion' then coalesce(c.rating, 0) end desc nulls last,
     c.d asc
   limit least(p_limite, 100) offset p_offset
$$;

-- Perfil publico de un prestador con sus metricas.
create or replace function public.perfil_prestador(
  p_user uuid, p_lat float8 default null, p_lng float8 default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pp  provider_profiles;
  p   profiles;
  pv  profile_private;
  o   record;
begin
  select * into pp from provider_profiles where user_id = p_user;
  if pp is null then
    return null;
  end if;
  if not (pp.status = 'aprobado' and pp.is_active) and p_user is distinct from auth.uid() and not es_admin() then
    return null;
  end if;
  if auth.uid() is not null and bloqueado(auth.uid(), p_user) then
    return null;
  end if;
  select * into p from profiles where id = p_user;
  select * into pv from profile_private where user_id = p_user;
  select * into o from origen_busqueda(p_lat, p_lng);

  return jsonb_build_object(
    'user_id', p.id,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'zone_label', p.zone_label,
    'bio', pp.bio,
    'price_range', pp.price_range,
    'coverage_radius_km', pp.coverage_radius_km,
    'status', pp.status,
    'categorias', (select coalesce(jsonb_agg(category_id order by category_id), '[]'::jsonb)
                     from provider_services where user_id = p_user),
    'distancia_km', case when pv.lat is null then null
                         else distancia_publica(dist_km(o.lat, o.lng, pv.lat, pv.lng)) end,
    'calificacion', (select round(avg(rating)::numeric, 1) from reviews
                      where reviewee_id = p_user and rol_calificado = 'prestador'),
    'cant_resenas', (select count(*) from reviews
                      where reviewee_id = p_user and rol_calificado = 'prestador'),
    'trabajos_realizados', (select count(*) from jobs
                             where assigned_provider_id = p_user and status = 'cerrado'),
    'contactos_recibidos', (select count(distinct actor_id) from contact_events
                             where target_id = p_user and kind in ('whatsapp', 'revelar_telefono', 'chat')),
    'contacto', case when pv.show_phone then 'whatsapp' else 'chat' end,
    'miembro_desde', p.created_at
  );
end
$$;

-- Telefono de alguien: solo con sesion, si lo tiene visible, sin
-- bloqueos y dentro del radio que eligio (30 km por defecto).
create or replace function public.obtener_contacto(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  yo     uuid := auth.uid();
  suyo   profile_private;
  mio    profile_private;
begin
  if yo is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
  end if;
  if bloqueado(yo, p_user) then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
  end if;
  select * into suyo from profile_private where user_id = p_user;
  if suyo is null or not suyo.show_phone then
    return jsonb_build_object('ok', false, 'motivo', 'oculto');
  end if;
  if suyo.phone is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_telefono');
  end if;
  select * into mio from profile_private where user_id = yo;
  if mio.lat is null or suyo.lat is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_ubicacion');
  end if;
  if dist_km(mio.lat, mio.lng, suyo.lat, suyo.lng) > suyo.phone_radius_km then
    return jsonb_build_object('ok', false, 'motivo', 'lejos');
  end if;
  -- Anti-scraping: tope de numeros distintos revelados por dia.
  if (select count(distinct target_id) from contact_events
       where actor_id = yo and kind = 'revelar_telefono'
         and created_at > now() - interval '24 hours'
         and target_id <> p_user) >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;

  insert into contact_events (actor_id, target_id, kind) values (yo, p_user, 'revelar_telefono');
  return jsonb_build_object('ok', true, 'telefono', suyo.phone);
end
$$;

-- Pedidos abiertos cerca, para prestadores. Por defecto solo mis rubros
-- y dentro de mi radio de cobertura (o 15 km si no soy prestador).
create or replace function public.pedidos_cerca(
  p_solo_mis_rubros boolean default true,
  p_radio_km        int default null
)
returns table (
  id             uuid,
  title          text,
  description    text,
  category_id    int,
  urgency        text,
  preferred_date date,
  zone_label     text,
  distancia_km   numeric,
  status         text,
  created_at     timestamptz,
  client_id      uuid,
  client_name    text,
  client_avatar  text,
  client_rating  numeric,
  fotos          bigint,
  ya_me_ofreci   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select pv.lat, pv.lng,
           coalesce(p_radio_km, pp.coverage_radius_km, 15) as radio
      from profile_private pv
      left join provider_profiles pp on pp.user_id = pv.user_id
     where pv.user_id = auth.uid() and pv.lat is not null
  )
  select j.id, j.title, j.description, j.category_id, j.urgency, j.preferred_date, j.zone_label,
         distancia_publica(dist_km(yo.lat, yo.lng, jp.lat, jp.lng)),
         j.status, j.created_at, j.client_id, p.full_name, p.avatar_url,
         (select round(avg(r.rating)::numeric, 1) from reviews r
           where r.reviewee_id = j.client_id and r.rol_calificado = 'cliente'),
         (select count(*) from job_photos f where f.job_id = j.id),
         exists (select 1 from applications a where a.job_id = j.id and a.provider_id = auth.uid())
    from jobs j
    join job_private jp on jp.job_id = j.id
    join profiles p on p.id = j.client_id
    cross join yo
   where j.status in ('abierto', 'en_conversacion')
     and j.client_id <> auth.uid()
     and not bloqueado(auth.uid(), j.client_id)
     and dist_km(yo.lat, yo.lng, jp.lat, jp.lng) <= yo.radio
     and (not p_solo_mis_rubros or exists (
           select 1 from provider_services ps
            where ps.user_id = auth.uid() and ps.category_id = j.category_id))
   order by j.created_at desc
   limit 100
$$;

-- Distancia a un pedido puntual (para el detalle), redondeada.
create or replace function public.distancia_a_pedido(p_job uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select distancia_publica(dist_km(pv.lat, pv.lng, jp.lat, jp.lng))
    from job_private jp
    join profile_private pv on pv.user_id = auth.uid()
   where jp.job_id = p_job and pv.lat is not null
$$;
