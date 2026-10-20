alter table public.profile_private add column share_location boolean not null default false;

-- No queda ningun dato derivado de ubicacion disponible por la tabla publica.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, is_admin, created_at) on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant update (phone, show_phone, phone_radius_km, location_precision, share_location)
  on public.profile_private to authenticated;
