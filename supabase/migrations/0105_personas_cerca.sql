-- "Cerca tuyo": gente que eligio aparecer para desconocidos.
-- Apagado por defecto. Nunca se devuelve un punto: solo barrio, distancia
-- aproximada y oficios. La distancia se calcula contra un punto difuminado en
-- una grilla de ~1,6 km, asi que acercandose no se puede triangular a nadie.
alter table public.profile_private
  add column es_publico boolean not null default false;

grant update (es_publico) on public.profile_private to authenticated;

create or replace function public.personas_cerca(p_radio_km int default 15)
returns table (
  user_id      uuid,
  full_name    text,
  avatar_url   text,
  zona         text,
  distancia_km numeric,
  oficios      text[],
  estado       text
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (
    select lat, lng from profile_private where user_id = auth.uid() and lat is not null and lng is not null
  ),
  candidatos as (
    select p.id, p.full_name, p.avatar_url, pv.lat, pv.lng, pv.location_precision, d.lat dlat, d.lng dlng
      from profile_private pv
      join profiles p on p.id = pv.user_id
      cross join lateral difuminar(pv.lat, pv.lng, p.id, 0.015) d
     where auth.uid() is not null
       and pv.es_publico
       and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days'
       and p.id <> auth.uid()
       and not bloqueado(auth.uid(), p.id)
       and not es_contacto(auth.uid(), p.id)
  )
  select c.id, c.full_name, c.avatar_url,
         zona_de(c.dlat, c.dlng, c.location_precision),
         distancia_publica(dist_km(yo.lat, yo.lng, c.dlat, c.dlng)),
         coalesce((select array_agg(o.label order by o.label) from (
                     select label from oficios where user_id = c.id order by label limit 5) o), '{}'),
         case when exists (select 1 from contacts k where k.requester_id = auth.uid() and k.addressee_id = c.id) then 'enviada'
              when exists (select 1 from contacts k where k.addressee_id = auth.uid() and k.requester_id = c.id) then 'recibida' end
    from candidatos c
    cross join yo
   where dist_km(yo.lat, yo.lng, c.dlat, c.dlng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
   order by dist_km(yo.lat, yo.lng, c.dlat, c.dlng), c.full_name
   limit 30
$$;

revoke all on function public.personas_cerca(int) from public, anon, authenticated;
grant execute on function public.personas_cerca(int) to authenticated;
