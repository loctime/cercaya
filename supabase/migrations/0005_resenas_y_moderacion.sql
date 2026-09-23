-- =====================================================================
-- Resenas (solo sobre trabajos cerrados, en las dos direcciones),
-- denuncias, administracion y borrado de cuenta.
-- =====================================================================

create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references public.jobs(id) on delete cascade,
  reviewer_id        uuid references public.profiles(id) on delete set null,
  reviewee_id        uuid not null references public.profiles(id) on delete cascade,
  -- A quien se califica: al prestador (lo que se ve en su perfil) o al
  -- cliente (protege a los prestadores de clientes problematicos).
  rol_calificado     text not null check (rol_calificado in ('prestador', 'cliente')),
  rating             int not null check (rating between 1 and 5),
  comment            text check (char_length(comment) <= 1000),
  -- Hubo "Llegue" a menos de 150 m del pedido y el prestador estuvo al
  -- menos 10 minutos. Lo calcula el servidor.
  trabajo_verificado boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (job_id, rol_calificado)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id, rol_calificado, created_at desc);

create or replace function public.calificar(p_job uuid, p_rating int, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo        uuid := auth.uid();
  job       jobs;
  otro      uuid;
  rol       text;
  verif     boolean;
  nombre    text;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.status <> 'cerrado' then
    raise exception 'Solo se califican trabajos terminados';
  end if;
  if yo = job.client_id then
    otro := job.assigned_provider_id;
    rol := 'prestador';
  elsif yo = job.assigned_provider_id then
    otro := job.client_id;
    rol := 'cliente';
  else
    raise exception 'No participaste de este trabajo';
  end if;
  if otro is null then
    raise exception 'La otra persona ya no esta en CercaYa';
  end if;

  select exists (
    select 1 from job_checkins
     where job_id = p_job and arrive_distance_m <= 150
       and left_at is not null and left_at - arrived_at >= interval '10 minutes'
  ) into verif;

  insert into reviews (job_id, reviewer_id, reviewee_id, rol_calificado, rating, comment, trabajo_verificado)
  values (p_job, yo, otro, rol, p_rating, nullif(trim(p_comment), ''), verif);

  select full_name into nombre from profiles where id = yo;
  perform encolar_notificacion(otro, 'resena', 'Recibiste una calificacion',
    nombre || ' te dejo ' || p_rating || ' estrellas', jsonb_build_object('job_id', p_job));
exception
  when unique_violation then
    raise exception 'Ya calificaste este trabajo';
end
$$;

-- ---------------------------------------------------------------------
-- Denuncias
-- ---------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('perfil', 'resena', 'pedido', 'mensaje', 'chat')),
  target_id   uuid not null,
  reason      text not null check (reason in ('estafa', 'spam', 'ofensivo', 'falso', 'otro')),
  detail      text check (char_length(detail) <= 1000),
  status      text not null default 'pendiente' check (status in ('pendiente', 'revisada', 'descartada')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace function public.limitar_denuncias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from reports
       where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Llegaste al limite de denuncias por dia';
  end if;
  return new;
end
$$;

create trigger reports_limite
before insert on public.reports
for each row execute function public.limitar_denuncias();

create or replace function public.admin_resolver_denuncia(p_report uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'Solo administradores';
  end if;
  if p_status not in ('revisada', 'descartada') then
    raise exception 'Estado invalido';
  end if;
  update reports set status = p_status, resolved_at = now() where id = p_report;
end
$$;

-- ---------------------------------------------------------------------
-- Borrar mi cuenta (exigencia de Apple). Borra el usuario de auth y por
-- cascada todo lo suyo. Sus resenas y mensajes quedan anonimos
-- ("Usuario eliminado"). Los archivos de storage los borra la app antes
-- de llamar a esta funcion.
-- ---------------------------------------------------------------------
create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesion';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

create policy reviews_lectura on public.reviews for select using (true);

create policy reports_crear on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_lectura on public.reports for select using (reporter_id = auth.uid() or es_admin());
