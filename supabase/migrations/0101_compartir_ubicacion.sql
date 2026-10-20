-- Compartir ubicacion con contactos (apagado por defecto) y cierre de las
-- columnas de profiles derivadas de la ubicacion exacta.
alter table public.profile_private
  add column share_location boolean not null default false;

-- approx_lat, approx_lng y zone_label salen de la ubicacion exacta y hoy las
-- lee cualquiera. Quedan cerradas: los contactos ven zona solo por
-- perfil_social() y solo si la persona esta compartiendo.
-- Los invitados siguen leyendo lo basico (nombre y foto): las resenas de un
-- prestador muestran quien las escribio y se puede navegar sin cuenta.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, created_at) on public.profiles to anon, authenticated;
grant select (is_admin) on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant update (phone, show_phone, phone_radius_km, location_precision, share_location)
  on public.profile_private to authenticated;
