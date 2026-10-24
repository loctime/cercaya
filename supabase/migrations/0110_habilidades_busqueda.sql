-- Habilidades cotidianas: una persona puede declarar un oficio profesional y
-- tambien pequenas tareas que sabe resolver. El catalogo aporta sugerencias y
-- sinonimos; la etiqueta elegida sigue siendo la que se muestra en su perfil.

alter table public.oficios
  add column tipo text not null default 'oficio' check (tipo in ('oficio', 'tarea')),
  add column catalog_id text;

create table public.habilidades_catalogo (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  label       text not null unique check (char_length(label) between 2 and 40),
  tipo        text not null check (tipo in ('oficio', 'tarea')),
  category_id int references public.categories(id),
  aliases     text[] not null default '{}'
);

alter table public.oficios
  add constraint oficios_catalogo_fk foreign key (catalog_id) references public.habilidades_catalogo(id) on delete set null;

insert into public.habilidades_catalogo (id, label, tipo, category_id, aliases) values
  ('electricista', 'Electricista', 'oficio', 5, array['electricidad','instalacion electrica','luces']),
  ('plomero', 'Plomero', 'oficio', 4, array['plomeria','sanitario','canerias']),
  ('pintor', 'Pintor', 'oficio', 6, array['pintura','pintar']),
  ('albanil', 'Albañil', 'oficio', 7, array['albanileria','construccion']),
  ('jardinero', 'Jardinero', 'oficio', 3, array['jardineria','jardin','plantas']),
  ('limpieza', 'Limpieza del hogar', 'oficio', 8, array['limpiar casa','empleada domestica']),
  ('podador', 'Podador', 'oficio', 2, array['poda','arboles']),
  ('cambiar-lamparita', 'Cambiar una lamparita', 'tarea', 5, array['cambiar lampara','cambiar bombilla','cambiar foco','poner una lamparita','reemplazar lampara']),
  ('colgar-cuadro', 'Colgar un cuadro o espejo', 'tarea', null, array['colgar cuadros','colgar espejo','hacer un agujero','taladro']),
  ('armar-muebles', 'Armar muebles', 'tarea', null, array['armar un mueble','ensamblar muebles','mueble de caja']),
  ('destapar-desague', 'Destapar un desagüe', 'tarea', 4, array['destapar pileta','destapar bacha','destapar caneria','destapar baño']),
  ('arreglar-canilla', 'Arreglar una canilla', 'tarea', 4, array['cambiar cuerito','canilla pierde','arreglar grifo','perdida de agua']),
  ('cortar-pasto', 'Cortar el pasto', 'tarea', 1, array['corte de pasto','cortar cesped','cortar jardin']),
  ('podar-arbustos', 'Podar arbustos', 'tarea', 2, array['poda de arbustos','podar plantas']),
  ('limpiar-patio', 'Limpiar un patio', 'tarea', 3, array['limpieza de jardin','limpiar jardin','juntar hojas']),
  ('pintar-pared', 'Pintar una pared', 'tarea', 6, array['pintar pared','retocar pintura']),
  ('arreglos-albanileria', 'Arreglos de albañilería', 'tarea', 7, array['arreglar pared','revoque','arreglar vereda']),
  ('limpiar-casa', 'Limpiar una casa', 'tarea', 8, array['limpieza de casa','limpiar hogar']),
  ('lavar-auto', 'Lavar autos', 'tarea', null, array['lavado de auto','lavar coche']),
  ('hacer-mandados', 'Hacer mandados', 'tarea', null, array['hacer un mandado','compras','ir a buscar']),
  ('pasear-perros', 'Pasear perros', 'tarea', null, array['pasear mascotas','sacar a pasear perro']),
  ('cuidar-mascotas', 'Cuidar mascotas', 'tarea', null, array['cuidar perros','cuidar gatos','pet sitter']),
  ('ayuda-computadora', 'Ayuda con computadora o celular', 'tarea', null, array['arreglar computadora','ayuda celular','configurar celular','informatica']),
  ('clases-particulares', 'Dar clases particulares', 'tarea', null, array['apoyo escolar','clases de apoyo','enseñar'])
on conflict (id) do nothing;

alter table public.habilidades_catalogo enable row level security;
create policy habilidades_catalogo_lectura on public.habilidades_catalogo for select using (true);
revoke all on table public.habilidades_catalogo from public, anon, authenticated;
grant select on public.habilidades_catalogo to authenticated;
grant update (tipo, catalog_id) on public.oficios to authenticated;

-- Igualamos tildes y mayusculas para que "lampara" y "lámpara" den el
-- mismo resultado, sin depender de una extension adicional de Postgres.
create or replace function public.normalizar_busqueda(p_texto text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(translate(lower(coalesce(p_texto, '')),
    'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')
$$;

create or replace function public.buscar_habilidades_cerca(p_texto text, p_radio_km int default 15)
returns table (
  user_id uuid, full_name text, avatar_url text, zona text, distancia_km numeric,
  oficios text[], estado text, lat float8, lng float8
)
language sql stable security definer set search_path = public as $$
  with q as (
    select regexp_split_to_array(trim(normalizar_busqueda(p_texto)), '\\s+') palabras
  ), yo as (
    select lat, lng from profile_private where user_id = auth.uid() and lat is not null and lng is not null
  ), candidatos as (
    select p.id, p.full_name, p.avatar_url, pv.location_precision, d.lat dlat, d.lng dlng
      from profile_private pv
      join profiles p on p.id = pv.user_id
      cross join lateral difuminar(pv.lat, pv.lng, p.id, 0.015) d
     where auth.uid() is not null and pv.es_publico and pv.lat is not null and pv.lng is not null
       and pv.location_updated_at > now() - interval '7 days' and p.id <> auth.uid()
       and not bloqueado(auth.uid(), p.id) and not es_contacto(auth.uid(), p.id)
  )
  select c.id, c.full_name, c.avatar_url, zona_de(c.dlat, c.dlng, c.location_precision),
         distancia_publica(dist_km(yo.lat, yo.lng, c.dlat, c.dlng)),
         coalesce((select array_agg(o.label order by o.label) from (
           select label from oficios where user_id = c.id order by label limit 5) o), '{}'),
         case when exists (select 1 from contacts k where k.requester_id = auth.uid() and k.addressee_id = c.id) then 'enviada'
              when exists (select 1 from contacts k where k.addressee_id = auth.uid() and k.requester_id = c.id) then 'recibida' end,
         c.dlat, c.dlng
    from candidatos c cross join yo cross join q
   where cardinality(q.palabras) > 0
     and dist_km(yo.lat, yo.lng, c.dlat, c.dlng) <= least(greatest(coalesce(p_radio_km, 15), 1), 50)
     and exists (
       select 1 from oficios o left join habilidades_catalogo h on h.id = o.catalog_id
        where o.user_id = c.id
          and not exists (
            select 1 from unnest(q.palabras) palabra
             where normalizar_busqueda(o.label || ' ' || coalesce(array_to_string(h.aliases, ' '), '')) not like '%' || palabra || '%'
          )
     )
   order by dist_km(yo.lat, yo.lng, c.dlat, c.dlng), c.full_name
   limit 30
$$;

revoke all on function public.normalizar_busqueda(text), public.buscar_habilidades_cerca(text, int) from public, anon, authenticated;
grant execute on function public.buscar_habilidades_cerca(text, int) to authenticated;
