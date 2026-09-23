-- Categorias iniciales (iconos = nombres de lucide).
insert into public.categories (slug, name, icon, sort) values
  ('corte-de-pasto',     'Corte de pasto',     'scissors',     1),
  ('poda-de-arboles',    'Poda de árboles',    'trees',        2),
  ('limpieza-de-jardin', 'Limpieza de jardín', 'leaf',         3),
  ('plomeria',           'Plomería',           'wrench',       4),
  ('electricidad',       'Electricidad',       'zap',          5),
  ('pintura',            'Pintura',            'paint-roller', 6),
  ('albanileria',        'Albañilería',        'brick-wall',   7),
  ('limpieza-del-hogar', 'Limpieza del hogar', 'sparkles',     8);

-- Localidades de la zona. Coordenadas aproximadas del centro de cada
-- una: revisarlas antes de sumar barrios.
insert into public.zones (name, localidad, lat, lng) values
  ('Ramallo',               'Ramallo',               -33.4833, -60.0167),
  ('Villa Ramallo',         'Villa Ramallo',         -33.5050, -60.0650),
  ('Pérez Millán',          'Pérez Millán',          -33.7667, -60.0833),
  ('Villa General Savio',   'Villa General Savio',   -33.4380, -60.1450),
  ('El Paraíso',            'El Paraíso',            -33.5650, -59.9800),
  ('San Nicolás',           'San Nicolás',           -33.3333, -60.2167);
