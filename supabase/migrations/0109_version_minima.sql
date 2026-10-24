-- =====================================================================
-- Version minima de la app. Las actualizaciones por internet (EAS Update) solo
-- llegan a quien tiene el mismo runtime (= version del APK). Quien tiene un APK
-- mas viejo no recibe nada: con esto la app le muestra una pantalla de
-- "descargá la nueva versión" en vez de seguir andando rota.
--
-- Para forzar: update app_config set valor = '1.2.0' where clave = 'version_minima';
-- =====================================================================
create table public.app_config (
  clave text primary key,
  valor text not null
);
alter table public.app_config enable row level security;

insert into public.app_config (clave, valor) values
  ('version_minima', '1.0.0'),
  ('url_descarga', ''),
  ('mensaje', 'Hay una versión nueva de CercaYa. Descargala para seguir usando la app.');

create or replace function public.version_app()
returns table (minima text, url_descarga text, mensaje text)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select valor from app_config where clave = 'version_minima'),
    nullif((select valor from app_config where clave = 'url_descarga'), ''),
    (select valor from app_config where clave = 'mensaje')
$$;

revoke all on table public.app_config from public, anon, authenticated;
revoke all on function public.version_app() from public, anon, authenticated;
grant execute on function public.version_app() to anon, authenticated;
