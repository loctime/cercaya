-- =====================================================================
-- Storage: la API de Supabase necesita permiso de LECTURA para borrar
-- (remove) o reemplazar (upsert) un archivo. Sin esto, al quitar una foto
-- de la galeria o cambiar el avatar el archivo quedaba huerfano.
-- avatares y galeria son buckets publicos: leerlos no expone nada nuevo.
-- En PGlite no hay esquema storage: se saltea.
-- =====================================================================
do $outer$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'cercaya_leer_publicos') then
    execute $p$
      create policy "cercaya_leer_publicos" on storage.objects for select to authenticated
      using (bucket_id in ('avatares', 'galeria'))
    $p$;
  end if;
end
$outer$;
