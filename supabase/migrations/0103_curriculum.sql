-- Curriculum y oficios. Los ve su duenio y sus contactos aceptados.
create table public.cv_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 80),
  lugar       text check (lugar is null or char_length(lugar) <= 80),
  desde_anio  int not null check (desde_anio between 1950 and 2100),
  hasta_anio  int check (hasta_anio is null or (hasta_anio between 1950 and 2100 and hasta_anio >= desde_anio)),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),
  created_at  timestamptz not null default now()
);

create table public.oficios (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text not null check (char_length(label) between 2 and 40),
  category_id int references public.categories(id),
  primary key (user_id, label)
);

alter table public.cv_entries enable row level security;
alter table public.oficios enable row level security;

create policy cv_leer on public.cv_entries for select
  using (user_id = auth.uid() or es_contacto(auth.uid(), user_id));
create policy cv_escribir on public.cv_entries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy oficios_leer on public.oficios for select
  using (user_id = auth.uid() or es_contacto(auth.uid(), user_id));
create policy oficios_escribir on public.oficios for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.limitar_social()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'cv_entries' and (select count(*) from cv_entries where user_id = new.user_id) >= 20 then
    raise exception 'Hasta 20 experiencias';
  end if;
  if tg_table_name = 'oficios' and (select count(*) from oficios where user_id = new.user_id) >= 15 then
    raise exception 'Hasta 15 oficios';
  end if;
  return new;
end
$$;

create trigger limite_cv before insert on public.cv_entries
  for each row execute function public.limitar_social();
create trigger limite_oficios before insert on public.oficios
  for each row execute function public.limitar_social();

revoke all on table public.cv_entries, public.oficios from public, anon, authenticated;
grant select, insert, delete on public.cv_entries, public.oficios to authenticated;
grant update (titulo, lugar, desde_anio, hasta_anio, descripcion) on public.cv_entries to authenticated;
grant update (label, category_id) on public.oficios to authenticated;
