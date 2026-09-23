-- Revisión de agy 23/09/2026:
-- 1) El botón de WhatsApp solo aparece si al tocarlo el servidor va a dar el
--    número (mismas reglas que obtener_contacto). Si no, la app muestra
--    directamente "Enviar mensaje" en vez de un botón que termina en error.
-- 2) "Contactos recibidos" deja de ser público: solo lo ve el propio
--    prestador (y admin).
-- buscar_prestadores y perfil_prestador son copia de 0006 con esos cambios;
-- create or replace conserva los permisos de 0090.

-- 'whatsapp' si quien mira puede obtener el número, si no 'chat'.
-- Con sesión se usa su ubicación guardada (como obtener_contacto); sin
-- sesión, el origen de la búsqueda (al tocar se le pide entrar igual).
-- No aplica el tope diario anti-scraping: ese caso raro sigue avisando.
create or replace function public.contacto_para(p_user uuid, p_lat float8, p_lng float8)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  suyo  profile_private;
  mio   profile_private;
begin
  select * into suyo from profile_private where user_id = p_user;
  if suyo is null or not suyo.show_phone or suyo.phone is null or suyo.lat is null then
    return 'chat';
  end if;
  if yo is null then
    return case when dist_km(p_lat, p_lng, suyo.lat, suyo.lng) <= suyo.phone_radius_km
                then 'whatsapp' else 'chat' end;
  end if;
  if bloqueado(yo, p_user) then
    return 'chat';
  end if;
  select * into mio from profile_private where user_id = yo;
  if mio is null or mio.lat is null
     or dist_km(mio.lat, mio.lng, suyo.lat, suyo.lng) > suyo.phone_radius_km then
    return 'chat';
  end if;
  return 'whatsapp';
end
$$;

revoke all on function public.contacto_para(uuid, float8, float8) from public, anon, authenticated;

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
         contacto_para(c.user_id, o.lat, o.lng)
    from con_datos c, norm n, origen o
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
    -- Metrica para el propio prestador (y admin); a los vecinos no les aporta.
    'contactos_recibidos', case when p_user = auth.uid() or es_admin() then
                             (select count(distinct actor_id) from contact_events
                               where target_id = p_user and kind in ('whatsapp', 'revelar_telefono', 'chat'))
                           end,
    'contacto', contacto_para(p_user, o.lat, o.lng),
    'miembro_desde', p.created_at
  );
end
$$;
