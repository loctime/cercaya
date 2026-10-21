-- Nuevas categorias de oficios: Cerrajeria, Carpinteria, Gasista, Refrigeracion y aire.
insert into public.categories (slug, name, icon, sort) values
  ('cerrajeria',    'Cerrajería',            'key',       11),
  ('carpinteria',   'Carpintería',           'hammer',    12),
  ('gasista',       'Gasista',               'flame',     13),
  ('refrigeracion', 'Refrigeración y aire',  'snowflake', 14)
on conflict (slug) do nothing;
