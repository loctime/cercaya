-- =====================================================================
-- Pedidos, chat y ciclo del trabajo.
--
-- Ciclo: abierto -> en_conversacion -> asignado -> realizado -> cerrado
--        (+ cancelado). "cerrado" = el prestador marco "trabajo
-- realizado" Y el cliente confirmo "trabajo conforme / pago acordado".
-- Recien ahi se puede calificar.
--
-- Todos los cambios de estado pasan por funciones: la app no puede
-- escribir jobs directo.
-- =====================================================================

create table public.jobs (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.profiles(id) on delete cascade,
  category_id          int not null references public.categories(id),
  title                text not null check (char_length(title) between 3 and 80),
  description          text not null check (char_length(description) between 10 and 2000),
  urgency              text not null check (urgency in ('hoy', 'semana', 'a_coordinar')),
  preferred_date       date,
  zone_label           text,
  approx_lat           numeric(6, 2),
  approx_lng           numeric(6, 2),
  status               text not null default 'abierto'
                       check (status in ('abierto', 'en_conversacion', 'asignado', 'realizado', 'cerrado', 'cancelado')),
  assigned_provider_id uuid references public.profiles(id) on delete set null,
  assigned_at          timestamptz,
  provider_done_at     timestamptz,
  client_confirmed_at  timestamptz,
  closed_at            timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now()
);

create index jobs_abiertos_idx on public.jobs (category_id, created_at desc)
  where status in ('abierto', 'en_conversacion');
create index jobs_cliente_idx on public.jobs (client_id, created_at desc);
create index jobs_prestador_idx on public.jobs (assigned_provider_id);

-- Ubicacion exacta del pedido: solo el cliente.
create table public.job_private (
  job_id       uuid primary key references public.jobs(id) on delete cascade,
  lat          float8 not null,
  lng          float8 not null,
  address_note text check (char_length(address_note) <= 200)
);

create table public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create or replace function public.limitar_fotos_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from job_photos where job_id = new.job_id) >= 3 then
    raise exception 'Un pedido admite hasta 3 fotos';
  end if;
  return new;
end
$$;

create trigger job_photos_limite
before insert on public.job_photos
for each row execute function public.limitar_fotos_pedido();

-- Prestadores que se ofrecieron a un pedido.
create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  message     text check (char_length(message) <= 500),
  created_at  timestamptz not null default now(),
  unique (job_id, provider_id)
);

-- "Llegue" / "Me voy" del prestador. Opcional (decision Diego 23/09):
-- solo suma la marca "trabajo verificado" en la resena.
create table public.job_checkins (
  job_id            uuid primary key references public.jobs(id) on delete cascade,
  provider_id       uuid not null references public.profiles(id) on delete cascade,
  arrived_at        timestamptz not null default now(),
  arrive_lat        float8 not null,
  arrive_lng        float8 not null,
  arrive_distance_m int not null,
  left_at           timestamptz,
  leave_lat         float8,
  leave_lng         float8,
  leave_distance_m  int
);

-- ---------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references public.jobs(id) on delete set null,
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  hidden_a        boolean not null default false,
  hidden_b        boolean not null default false,
  check (user_a < user_b)
);

create unique index conversations_unica_idx on public.conversations
  (user_a, user_b, coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  kind            text not null default 'texto' check (kind in ('texto', 'contacto', 'sistema')),
  body            text not null check (char_length(body) between 1 and 2000),
  contact_phone   text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index messages_conv_idx on public.messages (conversation_id, created_at);

create or replace function public.es_miembro(p_conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from conversations
     where id = p_conv and auth.uid() in (user_a, user_b)
  )
$$;

create or replace function public.otro_miembro(p_conv uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when user_a = auth.uid() then user_b else user_a end
    from conversations where id = p_conv
$$;

-- Controles al escribir: no escribir a quien te bloqueo, tope anti-spam.
create or replace function public.validar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv conversations;
begin
  select * into conv from conversations where id = new.conversation_id;
  if new.kind <> 'sistema' then
    if bloqueado(conv.user_a, conv.user_b) then
      raise exception 'No podes enviar mensajes a este usuario';
    end if;
    if (select count(*) from messages
         where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Estas enviando mensajes demasiado rapido';
    end if;
  end if;
  return new;
end
$$;

create trigger messages_validar
before insert on public.messages
for each row execute function public.validar_mensaje();

-- Despues de cada mensaje: actualiza la conversacion, la muestra de
-- nuevo si alguien la habia ocultado, avanza el pedido y notifica.
create or replace function public.despues_de_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv         conversations;
  destinatario uuid;
  remitente    text;
begin
  update conversations
     set last_message_at = new.created_at, hidden_a = false, hidden_b = false
   where id = new.conversation_id
  returning * into conv;

  if conv.job_id is not null and new.kind <> 'sistema' then
    update jobs set status = 'en_conversacion'
     where id = conv.job_id and status = 'abierto';
  end if;

  if new.kind <> 'sistema' and new.sender_id is not null then
    destinatario := case when conv.user_a = new.sender_id then conv.user_b else conv.user_a end;
    select full_name into remitente from profiles where id = new.sender_id;
    perform encolar_notificacion(destinatario, 'mensaje', remitente,
      case when new.kind = 'contacto' then 'Te compartio su contacto' else left(new.body, 120) end,
      jsonb_build_object('conversation_id', conv.id));
  end if;
  return new;
end
$$;

create trigger messages_despues
after insert on public.messages
for each row execute function public.despues_de_mensaje();

-- Mensaje de sistema en la conversacion de un pedido entre dos personas.
create or replace function public.mensaje_sistema(p_job uuid, p_u1 uuid, p_u2 uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  select id into conv_id from conversations
   where job_id = p_job and user_a = least(p_u1, p_u2) and user_b = greatest(p_u1, p_u2);
  if conv_id is not null then
    insert into messages (conversation_id, sender_id, kind, body)
    values (conv_id, null, 'sistema', p_body);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Funciones que llama la app
-- ---------------------------------------------------------------------

create or replace function public.publicar_pedido(
  p_category       int,
  p_title          text,
  p_description    text,
  p_urgency        text,
  p_preferred_date date default null,
  p_lat            float8 default null,
  p_lng            float8 default null,
  p_address_note   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo      uuid := auth.uid();
  v_lat   float8 := p_lat;
  v_lng   float8 := p_lng;
  nuevo   uuid;
  cat     text;
  prest   record;
begin
  if yo is null then
    raise exception 'Necesitas iniciar sesion';
  end if;
  if (select count(*) from jobs where client_id = yo and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Llegaste al limite de 5 pedidos por dia';
  end if;
  if v_lat is null or v_lng is null then
    select lat, lng into v_lat, v_lng from profile_private where user_id = yo;
  end if;
  if v_lat is null or v_lng is null then
    raise exception 'Necesitamos la ubicacion del trabajo';
  end if;

  insert into jobs (client_id, category_id, title, description, urgency, preferred_date,
                    zone_label, approx_lat, approx_lng)
  values (yo, p_category, trim(p_title), trim(p_description), p_urgency, p_preferred_date,
          zona_de(v_lat, v_lng, 'barrio'), round(v_lat::numeric, 2), round(v_lng::numeric, 2))
  returning id into nuevo;

  insert into job_private (job_id, lat, lng, address_note)
  values (nuevo, v_lat, v_lng, nullif(trim(p_address_note), ''));

  -- Avisar a los prestadores del rubro que cubren esa zona.
  select name into cat from categories where id = p_category;
  for prest in
    select pp.user_id
      from provider_profiles pp
      join provider_services ps on ps.user_id = pp.user_id and ps.category_id = p_category
      join profile_private pv on pv.user_id = pp.user_id
      join notification_prefs np on np.user_id = pp.user_id
     where pp.status = 'aprobado' and pp.is_active
       and pp.user_id <> yo
       and pv.lat is not null
       and dist_km(v_lat, v_lng, pv.lat, pv.lng) <= least(pp.coverage_radius_km, np.pedidos_radio_km)
       and not bloqueado(pp.user_id, yo)
  loop
    perform encolar_notificacion(prest.user_id, 'pedido_cerca', 'Pedido nuevo de ' || cat,
      left(trim(p_title), 120), jsonb_build_object('job_id', nuevo));
  end loop;

  return nuevo;
end
$$;

-- Abre (o reabre) un chat con otra persona, opcionalmente sobre un pedido.
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

-- "Enviar mi contacto": manda mi numero dentro del chat.
create or replace function public.compartir_contacto(p_conv uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo  uuid := auth.uid();
  tel text;
  conv conversations;
begin
  if not es_miembro(p_conv) then
    raise exception 'Conversacion invalida';
  end if;
  select phone into tel from profile_private where user_id = yo;
  if tel is null then
    raise exception 'Primero carga tu celular en el perfil';
  end if;
  select * into conv from conversations where id = p_conv;
  insert into messages (conversation_id, sender_id, kind, body, contact_phone)
  values (p_conv, yo, 'contacto', 'Te compartio su contacto', tel);
  insert into contact_events (actor_id, target_id, kind, job_id)
  values (yo, otro_miembro(p_conv), 'compartir_contacto', conv.job_id);
end
$$;

create or replace function public.marcar_leidos(p_conv uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update messages set read_at = now()
   where conversation_id = p_conv and read_at is null
     and sender_id is distinct from auth.uid()
     and es_miembro(p_conv)
$$;

create or replace function public.ocultar_chat(p_conv uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update conversations
     set hidden_a = case when user_a = auth.uid() then true else hidden_a end,
         hidden_b = case when user_b = auth.uid() then true else hidden_b end
   where id = p_conv and auth.uid() in (user_a, user_b)
$$;

-- Prestador: "Me interesa" en un pedido abierto.
create or replace function public.me_interesa(p_job uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo  uuid := auth.uid();
  job jobs;
  cid uuid;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.status not in ('abierto', 'en_conversacion') then
    raise exception 'El pedido ya no esta disponible';
  end if;
  if job.client_id = yo then
    raise exception 'Es tu propio pedido';
  end if;
  if not exists (
    select 1 from provider_profiles pp
      join provider_services ps on ps.user_id = pp.user_id
     where pp.user_id = yo and pp.status = 'aprobado' and ps.category_id = job.category_id
  ) then
    raise exception 'Tenes que estar aprobado como prestador de este rubro';
  end if;

  insert into applications (job_id, provider_id, message)
  values (p_job, yo, nullif(trim(p_message), ''))
  on conflict (job_id, provider_id) do nothing;

  cid := abrir_chat(job.client_id, p_job);
  if nullif(trim(p_message), '') is not null then
    insert into messages (conversation_id, sender_id, body) values (cid, yo, trim(p_message));
  else
    update jobs set status = 'en_conversacion' where id = p_job and status = 'abierto';
    perform encolar_notificacion(job.client_id, 'estado_pedido', 'Alguien se intereso en tu pedido',
      job.title, jsonb_build_object('job_id', p_job));
  end if;
  return cid;
end
$$;

create or replace function public.asignar_prestador(p_job uuid, p_provider uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.client_id <> auth.uid() then
    raise exception 'Pedido invalido';
  end if;
  if job.status not in ('abierto', 'en_conversacion') then
    raise exception 'El pedido ya tiene prestador o esta cerrado';
  end if;
  if not exists (select 1 from applications where job_id = p_job and provider_id = p_provider)
     and not exists (select 1 from conversations
                      where job_id = p_job
                        and user_a = least(job.client_id, p_provider)
                        and user_b = greatest(job.client_id, p_provider)) then
    raise exception 'Solo podes asignar a alguien con quien hablaste por este pedido';
  end if;

  update jobs set status = 'asignado', assigned_provider_id = p_provider, assigned_at = now()
   where id = p_job;
  perform mensaje_sistema(p_job, job.client_id, p_provider, 'El cliente te asigno este trabajo');
  perform encolar_notificacion(p_provider, 'estado_pedido', 'Te asignaron un trabajo',
    job.title, jsonb_build_object('job_id', p_job));
end
$$;

create or replace function public.checkin(p_job uuid, p_lat float8, p_lng float8)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  job  jobs;
  pos  job_private;
  dist int;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.assigned_provider_id is distinct from auth.uid() or job.status <> 'asignado' then
    raise exception 'No tenes este trabajo asignado';
  end if;
  if exists (select 1 from job_checkins where job_id = p_job) then
    raise exception 'Ya marcaste la llegada';
  end if;
  select * into pos from job_private where job_id = p_job;
  dist := round(dist_km(p_lat, p_lng, pos.lat, pos.lng) * 1000);
  insert into job_checkins (job_id, provider_id, arrive_lat, arrive_lng, arrive_distance_m)
  values (p_job, auth.uid(), p_lat, p_lng, dist);
  perform mensaje_sistema(p_job, job.client_id, auth.uid(), 'El prestador aviso que llego');
  perform encolar_notificacion(job.client_id, 'estado_pedido', 'El prestador llego',
    job.title, jsonb_build_object('job_id', p_job));
  return dist;
end
$$;

create or replace function public.checkout(p_job uuid, p_lat float8, p_lng float8)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pos job_private;
begin
  select * into pos from job_private where job_id = p_job;
  update job_checkins
     set left_at = now(), leave_lat = p_lat, leave_lng = p_lng,
         leave_distance_m = round(dist_km(p_lat, p_lng, pos.lat, pos.lng) * 1000)
   where job_id = p_job and provider_id = auth.uid() and left_at is null;
  if not found then
    raise exception 'No hay una llegada abierta para este trabajo';
  end if;
end
$$;

-- Cierre doble: cuando estan las dos confirmaciones el pedido se cierra.
create or replace function public.cerrar_si_corresponde(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job.provider_done_at is not null and job.client_confirmed_at is not null
     and job.status <> 'cerrado' then
    update jobs set status = 'cerrado', closed_at = now() where id = p_job;
    perform encolar_notificacion(job.client_id, 'estado_pedido', 'Trabajo terminado',
      'Ya podes calificar a quien lo hizo', jsonb_build_object('job_id', p_job));
    perform encolar_notificacion(job.assigned_provider_id, 'estado_pedido', 'Trabajo terminado',
      'Ya podes calificar al cliente', jsonb_build_object('job_id', p_job));
  end if;
end
$$;

create or replace function public.marcar_realizado(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.assigned_provider_id is distinct from auth.uid()
     or job.status <> 'asignado' then
    raise exception 'No podes marcar este trabajo';
  end if;
  update jobs set provider_done_at = now(), status = 'realizado' where id = p_job;
  perform mensaje_sistema(p_job, job.client_id, auth.uid(), 'El prestador marco el trabajo como realizado');
  if job.client_confirmed_at is null then
    perform encolar_notificacion(job.client_id, 'estado_pedido', 'Confirma el trabajo',
      'El prestador marco "' || job.title || '" como realizado', jsonb_build_object('job_id', p_job));
  end if;
  perform cerrar_si_corresponde(p_job);
end
$$;

create or replace function public.confirmar_trabajo(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.client_id <> auth.uid()
     or job.status not in ('asignado', 'realizado') or job.client_confirmed_at is not null then
    raise exception 'No podes confirmar este trabajo';
  end if;
  update jobs set client_confirmed_at = now() where id = p_job;
  perform mensaje_sistema(p_job, job.client_id, job.assigned_provider_id,
    'El cliente confirmo: trabajo conforme y pago acordado');
  if job.provider_done_at is null then
    perform encolar_notificacion(job.assigned_provider_id, 'estado_pedido', 'El cliente confirmo el trabajo',
      'Marca "trabajo realizado" para cerrarlo', jsonb_build_object('job_id', p_job));
  end if;
  perform cerrar_si_corresponde(p_job);
end
$$;

create or replace function public.cancelar_pedido(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.client_id <> auth.uid() or job.status in ('cerrado', 'cancelado') then
    raise exception 'No podes cancelar este pedido';
  end if;
  update jobs set status = 'cancelado', cancelled_at = now() where id = p_job;
  if job.assigned_provider_id is not null then
    perform mensaje_sistema(p_job, job.client_id, job.assigned_provider_id, 'El cliente cancelo el pedido');
    perform encolar_notificacion(job.assigned_provider_id, 'estado_pedido', 'Pedido cancelado',
      job.title, jsonb_build_object('job_id', p_job));
  end if;
end
$$;

-- Helpers para policies. Son security definer para que las policies de
-- jobs y applications no se consulten entre si (recursion infinita).
create or replace function public.es_cliente_de(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from jobs where id = p_job and client_id = auth.uid())
$$;

create or replace function public.me_ofreci(p_job uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from applications where job_id = p_job and provider_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.jobs enable row level security;
alter table public.job_private enable row level security;
alter table public.job_photos enable row level security;
alter table public.applications enable row level security;
alter table public.job_checkins enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Pedidos abiertos: los ve cualquier usuario logueado (no invitados).
-- Asignados en adelante: solo las partes (y quien se habia ofrecido).
create policy jobs_lectura on public.jobs for select using (
  (auth.uid() is not null and status in ('abierto', 'en_conversacion') and not bloqueado(client_id, auth.uid()))
  or client_id = auth.uid()
  or assigned_provider_id = auth.uid()
  or me_ofreci(id)
  or es_admin()
);

create policy job_private_cliente on public.job_private for select
  using (es_cliente_de(job_id));

create policy job_photos_lectura on public.job_photos for select
  using (exists (select 1 from jobs j where j.id = job_id));
create policy job_photos_crear on public.job_photos for insert
  with check (es_cliente_de(job_id));
create policy job_photos_borrar on public.job_photos for delete
  using (es_cliente_de(job_id));

create policy applications_lectura on public.applications for select using (
  provider_id = auth.uid()
  or es_cliente_de(job_id)
);

-- Del check-in las partes ven horario y distancia; la posicion cruda
-- queda sin grant de columna (ver 0090_permisos.sql).
create policy checkins_lectura on public.job_checkins for select using (
  provider_id = auth.uid()
  or es_cliente_de(job_id)
);

create policy conversations_lectura on public.conversations for select
  using (auth.uid() in (user_a, user_b));

create policy messages_lectura on public.messages for select using (es_miembro(conversation_id));
create policy messages_crear on public.messages for insert
  with check (sender_id = auth.uid() and kind = 'texto' and es_miembro(conversation_id));
