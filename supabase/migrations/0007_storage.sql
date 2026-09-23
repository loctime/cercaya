-- =====================================================================
-- Storage: avatares y galeria publicos; fotos de pedidos solo para
-- usuarios logueados. Cada usuario escribe solo en su carpeta
-- (<user_id>/...). En PGlite no hay esquema storage: se saltea.
-- =====================================================================
do $outer$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatares', 'avatares', true),
         ('galeria', 'galeria', true),
         ('pedidos', 'pedidos', false)
  on conflict (id) do nothing;

  execute $p$
    create policy "cercaya_subir_propio" on storage.objects for insert to authenticated
    with check (bucket_id in ('avatares', 'galeria', 'pedidos')
                and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "cercaya_editar_propio" on storage.objects for update to authenticated
    using (bucket_id in ('avatares', 'galeria', 'pedidos')
           and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "cercaya_borrar_propio" on storage.objects for delete to authenticated
    using (bucket_id in ('avatares', 'galeria', 'pedidos')
           and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "cercaya_leer_pedidos" on storage.objects for select to authenticated
    using (bucket_id = 'pedidos')
  $p$;
end
$outer$;
