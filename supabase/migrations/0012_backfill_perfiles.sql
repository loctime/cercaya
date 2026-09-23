-- Usuarios de auth creados antes de la base v2 (ej. la cuenta de Diego de
-- la web vieja) no tenian perfil: el trigger de alta solo corre al
-- registrarse. Sin perfil la app falla al entrar. Aplicado 23/09/2026.
insert into public.profiles (id, full_name)
select u.id, coalesce(left(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 80), split_part(u.email, '@', 1))
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.profile_private (user_id, phone)
select u.id, nullif(trim(u.raw_user_meta_data ->> 'phone'), '')
  from auth.users u
 where not exists (select 1 from public.profile_private p where p.user_id = u.id);

insert into public.notification_prefs (user_id)
select u.id
  from auth.users u
 where not exists (select 1 from public.notification_prefs p where p.user_id = u.id);
