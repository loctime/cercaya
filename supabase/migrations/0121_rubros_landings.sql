-- Rubros nuevos para los primeros negocios (landings de clientes de ControlApps).
-- La busqueda mira etiqueta + sinonimos (no el id): poner todas las formas del nombre.
insert into public.habilidades_catalogo (id, label, tipo, category_id, aliases) values
  ('odontologo', 'Odontólogo/a', 'oficio', null,
   array['odontologa', 'odontologia', 'dentista', 'dientes', 'muela', 'caries', 'limpieza dental', 'blanqueamiento', 'ortodoncia', 'arreglo dental']),
  ('comida-artesanal', 'Comida artesanal', 'oficio', null,
   array['untables', 'hummus', 'dulces', 'conservas', 'viandas', 'comida casera', 'productos caseros', 'alfajores', 'tortas', 'vegano', 'vegetariano'])
on conflict (id) do nothing;
