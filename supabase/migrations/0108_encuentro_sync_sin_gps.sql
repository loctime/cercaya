-- encuentro_sync sin posicion propia (todavia no hay GPS): devuelve solo el
-- estado del encuentro. No guarda nada y NO devuelve la posicion del otro: quien
-- no manda la suya no recibe la ajena. Antes tiraba "Posicion invalida" y, al
-- aceptar sin GPS, la pantalla quedaba trabada en "pendiente".
create or replace function public.encuentro_sync(p_id uuid, p_lat float8, p_lng float8)
returns table (
  estado       text,
  ends_at      timestamptz,
  otro_lat     float8,
  otro_lng     float8,
  otro_at      timestamptz,
  distancia_m  float8,
  llegaron     boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  yo    uuid := auth.uid();
  e     encounters;
  otro  uuid;
  po    encounter_positions;
  d     float8;
begin
  if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
  perform cerrar_vencidos();
  select * into e from encounters x where x.id = p_id and yo in (x.requester_id, x.addressee_id) for update;
  if not found then raise exception 'No sos parte de este encuentro'; end if;

  if e.status in ('pendiente', 'activo')
     and (bloqueado(e.requester_id, e.addressee_id) or not es_contacto(e.requester_id, e.addressee_id)) then
    perform cerrar_encuentro(e.id, 'terminado', yo);
    e.status := 'terminado';
  end if;

  if e.status <> 'activo' then
    if e.status <> 'pendiente' then
      delete from encounter_positions where encounter_id = e.id;
    end if;
    return query select e.status, e.ends_at, null::float8, null::float8, null::timestamptz, null::float8, false;
    return;
  end if;

  -- Sin posicion propia: solo el estado.
  if p_lat is null or p_lng is null then
    return query select e.status, e.ends_at, null::float8, null::float8, null::timestamptz, null::float8, false;
    return;
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Posicion invalida';
  end if;
  insert into encounter_positions (encounter_id, user_id, lat, lng, updated_at)
  values (e.id, yo, p_lat, p_lng, now())
  on conflict (encounter_id, user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();

  otro := case when e.requester_id = yo then e.addressee_id else e.requester_id end;
  select * into po from encounter_positions where encounter_id = e.id and user_id = otro;
  if not found then
    return query select e.status, e.ends_at, null::float8, null::float8, null::timestamptz, null::float8, false;
    return;
  end if;

  d := dist_km(p_lat, p_lng, po.lat, po.lng) * 1000;
  return query select e.status, e.ends_at, po.lat, po.lng, po.updated_at, d,
                      (d <= 50 and po.updated_at > now() - interval '2 minutes');
end
$$;

revoke all on function public.encuentro_sync(uuid, float8, float8) from public, anon, authenticated;
grant execute on function public.encuentro_sync(uuid, float8, float8) to authenticated;
