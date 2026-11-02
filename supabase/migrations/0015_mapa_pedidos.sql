-- Mapa para prestadores: cada pin se desplaza de forma deterministica hasta
-- ~1,7 km respecto de la coordenada aproximada. Nunca se devuelve la casa ni
-- la coordenada exacta guardada en job_private.
drop function if exists public.pedidos_cerca(boolean, int);

create function public.pedidos_cerca(
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
  map_lat        float8,
  map_lng        float8,
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
         j.approx_lat::float8 + ((mod(abs(hashtext(j.id::text)::bigint), 2001)::float8 / 2000) - 0.5) * 0.03,
         j.approx_lng::float8 + ((mod(abs(hashtext(j.id::text || 'lng')::bigint), 2001)::float8 / 2000) - 0.5) * 0.03,
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

revoke all on function public.pedidos_cerca(boolean, int) from public, anon, authenticated;
grant execute on function public.pedidos_cerca(boolean, int) to authenticated;
