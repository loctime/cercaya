-- =====================================================================
-- Bajas: cualquiera con cuenta puede sacar del mapa un negocio sin
-- reclamar ("esto no es mio / sacalo"). Se oculta en el momento y un
-- admin lo revisa despues (confirma o devuelve al mapa).
-- =====================================================================

create table public.negocio_bajas (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  motivo       text check (char_length(motivo) <= 300),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'revertida')),
  created_at   timestamptz not null default now(),
  resuelto_por uuid references public.profiles(id) on delete set null,
  resuelto_en  timestamptz
);

create index negocio_bajas_estado_idx on public.negocio_bajas (estado, created_at);
create index negocio_bajas_user_idx on public.negocio_bajas (user_id, created_at);

alter table public.negocio_bajas enable row level security;
revoke all on public.negocio_bajas from public, anon, authenticated;

create or replace function public.pedir_baja_negocio(p_negocio uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  neg negocios;
begin
  if yo is null then
    raise exception 'Iniciá sesión para pedir la baja';
  end if;
  select * into neg from negocios where id = p_negocio for update;
  if neg.id is null then
    raise exception 'No encontramos ese negocio';
  end if;
  if neg.estado = 'reclamado' then
    raise exception 'Este negocio tiene dueño: pedile que lo saque';
  end if;
  if neg.estado = 'oculto' then
    raise exception 'Este negocio ya está oculto';
  end if;
  if (select count(*) from negocio_bajas
       where user_id = yo and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de bajas de hoy';
  end if;

  insert into negocio_bajas (negocio_id, user_id, motivo)
  values (p_negocio, yo, nullif(trim(coalesce(p_motivo, '')), ''));
  update negocios set estado = 'oculto', motivo_oculto = 'baja', updated_at = now() where id = p_negocio;
end
$$;

create or replace function public.admin_bajas(p_estado text)
returns table (
  id uuid, negocio_id uuid, negocio_nombre text, instagram_usuario text,
  user_nombre text, motivo text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if p_estado not in ('pendiente', 'confirmada') then
    raise exception 'Estado inválido';
  end if;
  return query
    select b.id, b.negocio_id, n.nombre, n.instagram_usuario, p.full_name, b.motivo, b.created_at
      from negocio_bajas b
      join negocios n on n.id = b.negocio_id
      left join profiles p on p.id = b.user_id
     where b.estado = p_estado
       and (p_estado = 'pendiente' or n.estado = 'oculto')
     order by b.created_at desc;
end
$$;

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
    update negocios
       set estado = case when owner_id is null then 'sin_reclamar' else 'reclamado' end,
           motivo_oculto = null, updated_at = now()
     where id = b.negocio_id and estado = 'oculto';
  end if;
end
$$;

-- Para pedidos que llegan por mail o por DM (gente sin cuenta).
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
  insert into negocio_bajas (negocio_id, user_id, motivo, estado, resuelto_por, resuelto_en)
  values (p_negocio, null, nullif(trim(coalesce(p_motivo, '')), ''), 'confirmada', auth.uid(), now());
end
$$;

revoke all on function public.pedir_baja_negocio(uuid, text), public.admin_bajas(text),
  public.admin_resolver_baja(uuid, boolean), public.admin_ocultar_negocio(uuid, text)
  from public, anon, authenticated;
grant execute on function public.pedir_baja_negocio(uuid, text), public.admin_bajas(text),
  public.admin_resolver_baja(uuid, boolean), public.admin_ocultar_negocio(uuid, text)
  to authenticated;
