-- Nuevas categorias de oficios: Herreria y Zingueria.
insert into public.categories (slug, name, icon, sort) values
  ('herreria',  'Herrería',  'anvil',  9),
  ('zingueria', 'Zinguería', 'layers', 10)
on conflict (slug) do nothing;
