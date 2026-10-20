-- Mapa de contactos y perfil social. Nunca devuelven coordenadas exactas.

-- Contactos aceptados que estan compartiendo, con el punto difuminado en una
-- grilla de ~300 m. Pasados 30 minutos se marca desactualizada; pasadas 24 horas
-- deja de mostrarse.
create or replace function public.mapa_contactos()
returns table (
  user_id        uuid,
  full_name      text,
  avatar_url     text,
  lat            float8,
  lng            float8,
  actualizada_at timestamptz,
  desactualizada boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url, d.lat, d.lng,
         pv.location_updated_at,
         pv.location_updated_at < now() - interval '30 minutes'
    from contacts c
    join profile_private pv
      on pv.user_id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
    join profiles p on p.id = pv.user_id
    cross join lateral difuminar(pv.lat, pv.lng, p.id, 0.003) d
   where auth.uid() is not null
     and c.status = 'aceptado'
     and auth.uid() in (c.requester_id, c.addressee_id)
     and pv.share_location
     and pv.lat is not null and pv.lng is not null
     and pv.location_updated_at > now() - interval '24 hours'
     and not bloqueado(c.requester_id, c.addressee_id)
$$;

-- Perfil de otra persona. La zona solo se ve si es uno mismo, o un contacto
-- aceptado que esta compartiendo su ubicacion: si la apagó, no hay zona.
create or replace function public.perfil_social(p_user uuid)
returns table (
  user_id    uuid,
  full_name  text,
  avatar_url text,
  zone_label text,
  estado     text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url,
         case when p.id = auth.uid()
                or (es_contacto(auth.uid(), p.id) and pv.share_location)
              then zona_de(pv.lat, pv.lng, pv.location_precision)
         end,
         case
           when es_contacto(auth.uid(), p.id) then 'aceptado'
           when exists (select 1 from contacts c where c.requester_id = auth.uid() and c.addressee_id = p.id) then 'enviada'
           when exists (select 1 from contacts c where c.addressee_id = auth.uid() and c.requester_id = p.id) then 'recibida'
         end
    from profiles p
    left join profile_private pv on pv.user_id = p.id
   where auth.uid() is not null
     and p.id = p_user
     and not bloqueado(auth.uid(), p.id)
$$;

revoke all on function public.mapa_contactos(), public.perfil_social(uuid) from public, anon, authenticated;
grant execute on function public.mapa_contactos(), public.perfil_social(uuid) to authenticated;
