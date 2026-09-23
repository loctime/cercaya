-- =====================================================================
-- Notificaciones push: cada aviso nuevo en `notifications` se manda por
-- Expo Push a los celulares del usuario, directo desde la base con
-- pg_net (sin servidor intermedio). Si no hay tokens, queda solo en la
-- campanita de la app.
-- En PGlite no hay pg_net: el envio se saltea y el resto funciona igual.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end
$$;

-- Registra el token del celular para el usuario actual. Si el mismo
-- celular estaba registrado con otra cuenta (cambio de sesion), pasa a
-- esta: un celular recibe los avisos de quien esta logueado.
create or replace function public.registrar_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesion';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Token invalido';
  end if;
  delete from push_tokens where token = p_token;
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform);
end
$$;

create or replace function public.enviar_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mensajes jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', new.title,
           'body', new.body,
           'data', new.data || jsonb_build_object('kind', new.kind, 'notification_id', new.id),
           'sound', 'default',
           'channelId', 'default',
           'priority', 'high'))
    into mensajes
    from push_tokens t
   where t.user_id = new.user_id;

  if mensajes is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := mensajes,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
  update notifications set sent_at = now() where id = new.id;
  return new;
end
$$;

drop trigger if exists notifications_enviar_push on public.notifications;
create trigger notifications_enviar_push
after insert on public.notifications
for each row execute function public.enviar_push();

revoke execute on function public.registrar_push_token(text, text) from public, anon;
revoke execute on function public.enviar_push() from public, anon, authenticated;
grant execute on function public.registrar_push_token(text, text) to authenticated;
