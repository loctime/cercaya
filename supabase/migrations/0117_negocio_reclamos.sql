-- =====================================================================
-- Reclamo de negocios: el dueño pide quedarse con el perfil, recibe un
-- codigo y lo manda por DM a @cercaya desde la cuenta del negocio. Un
-- admin lo aprueba o lo rechaza. "Vencido" no es un estado guardado:
-- es un reclamo pendiente con vence_at en el pasado.
-- =====================================================================

create table public.negocio_reclamos (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  codigo       text not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  created_at   timestamptz not null default now(),
  vence_at     timestamptz not null default now() + interval '7 days',
  resuelto_por uuid references public.profiles(id) on delete set null,
  resuelto_en  timestamptz
);

create unique index negocio_reclamos_pendiente_uk
  on public.negocio_reclamos (negocio_id, user_id) where estado = 'pendiente';
create index negocio_reclamos_user_idx on public.negocio_reclamos (user_id, estado);

alter table public.negocio_reclamos enable row level security;
revoke all on public.negocio_reclamos from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- reclamar_negocio: devuelve el codigo de 6 caracteres.
-- ---------------------------------------------------------------------
create or replace function public.reclamar_negocio(p_negocio uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  mail text := trim(coalesce(p_email, ''));
  existente text;
  nuevo text;
begin
  if yo is null then
    raise exception 'Iniciá sesión para reclamar';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(mail) > 200 then
    raise exception 'Revisá el mail';
  end if;
  if not exists (select 1 from negocios where id = p_negocio and estado = 'sin_reclamar') then
    raise exception 'Este negocio ya no se puede reclamar';
  end if;

  select codigo into existente from negocio_reclamos
   where negocio_id = p_negocio and user_id = yo and estado = 'pendiente' and vence_at > now();
  if existente is not null then
    return existente;
  end if;

  if (select count(*) from negocio_reclamos
       where user_id = yo and estado = 'pendiente' and vence_at > now()) >= 3 then
    raise exception 'Tenés 3 reclamos pendientes. Esperá a que los revisemos';
  end if;

  -- Un reclamo vencido de este mismo usuario no puede estorbar al nuevo.
  update negocio_reclamos set estado = 'rechazado', resuelto_en = now()
   where negocio_id = p_negocio and user_id = yo and estado = 'pendiente';

  nuevo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into negocio_reclamos (negocio_id, user_id, email, codigo)
  values (p_negocio, yo, mail, nuevo);
  return nuevo;
end
$$;

create or replace function public.mi_reclamo(p_negocio uuid)
returns table (codigo text, vence_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.codigo, r.vence_at
    from negocio_reclamos r
   where r.negocio_id = p_negocio and r.user_id = auth.uid()
     and r.estado = 'pendiente' and r.vence_at > now()
$$;

-- ---------------------------------------------------------------------
-- Admin: lista y resolucion.
-- ---------------------------------------------------------------------
create or replace function public.admin_reclamos_pendientes()
returns table (
  id uuid, negocio_id uuid, negocio_nombre text, instagram_usuario text, user_id uuid,
  user_nombre text, email text, codigo text, created_at timestamptz, vence_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  return query
    select r.id, r.negocio_id, n.nombre, n.instagram_usuario, r.user_id, p.full_name,
           r.email, r.codigo, r.created_at, r.vence_at
      from negocio_reclamos r
      join negocios n on n.id = r.negocio_id
      join profiles p on p.id = r.user_id
     where r.estado = 'pendiente' and r.vence_at > now()
     order by r.created_at;
end
$$;

create or replace function public.admin_resolver_reclamo(p_reclamo uuid, p_aprueba boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r negocio_reclamos;
  neg_nombre text;
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  select * into r from negocio_reclamos where id = p_reclamo for update;
  if r.id is null or r.estado <> 'pendiente' then
    raise exception 'Ese reclamo ya fue resuelto';
  end if;
  if r.vence_at <= now() then
    raise exception 'El reclamo venció';
  end if;
  select nombre into neg_nombre from negocios where id = r.negocio_id;

  if p_aprueba then
    update negocios set estado = 'reclamado', owner_id = r.user_id, updated_at = now()
     where id = r.negocio_id and estado = 'sin_reclamar';
    if not found then
      raise exception 'Este negocio ya no se puede reclamar';
    end if;
    update negocio_reclamos set estado = 'aprobado', resuelto_por = auth.uid(), resuelto_en = now()
     where id = r.id;
    update negocio_reclamos set estado = 'rechazado', resuelto_por = auth.uid(), resuelto_en = now()
     where negocio_id = r.negocio_id and estado = 'pendiente' and id <> r.id;
    perform encolar_notificacion(r.user_id, 'sistema', 'Tu negocio ya es tuyo',
      neg_nombre || ' ya está a tu nombre en CercaYa. Entrá a Mis negocios para completarlo.',
      jsonb_build_object('negocio_id', r.negocio_id));
  else
    update negocio_reclamos set estado = 'rechazado', resuelto_por = auth.uid(), resuelto_en = now()
     where id = r.id;
    perform encolar_notificacion(r.user_id, 'sistema', 'No pudimos verificar tu negocio',
      'No recibimos el código de ' || neg_nombre || '. Podés volver a intentarlo cuando quieras.',
      jsonb_build_object('negocio_id', r.negocio_id));
  end if;
end
$$;

revoke all on function public.reclamar_negocio(uuid, text), public.mi_reclamo(uuid),
  public.admin_reclamos_pendientes(), public.admin_resolver_reclamo(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reclamar_negocio(uuid, text), public.mi_reclamo(uuid),
  public.admin_reclamos_pendientes(), public.admin_resolver_reclamo(uuid, boolean)
  to authenticated;
