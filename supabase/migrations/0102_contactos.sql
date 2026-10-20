create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'aceptado')),
  created_at timestamptz not null default now(), responded_at timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create unique index contacts_pareja_unica on public.contacts (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.contacts enable row level security;

create or replace function public.es_contacto(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from contacts where status = 'aceptado' and ((requester_id=a and addressee_id=b) or (requester_id=b and addressee_id=a)))
$$;
create or replace function public.solicitar_contacto(p_destino uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare yo uuid := auth.uid(); r contacts;
begin
 if yo is null then raise exception 'Necesitas iniciar sesion'; end if;
 if yo = p_destino then raise exception 'No podes agregarte a vos mismo'; end if;
 if bloqueado(yo,p_destino) then raise exception 'No se puede enviar la solicitud'; end if;
 if (select count(*) from contacts where requester_id=yo and created_at > now()-interval '24 hours') >= 20 then raise exception 'Limite diario de solicitudes'; end if;
 -- serializa ambos sentidos, incluso si llegan dos taps al mismo tiempo.
 perform pg_advisory_xact_lock(hashtext(least(yo::text,p_destino::text) || greatest(yo::text,p_destino::text)));
 select * into r from contacts where (requester_id=yo and addressee_id=p_destino) or (requester_id=p_destino and addressee_id=yo) for update;
 if found then
   if r.status='pendiente' and r.addressee_id=yo then update contacts set status='aceptado', responded_at=now() where id=r.id; return r.id; end if;
   raise exception 'Ya son contactos o hay una solicitud';
 end if;
 insert into contacts(requester_id,addressee_id) values(yo,p_destino) returning id into r.id;
 return r.id;
end $$;
create or replace function public.responder_contacto(p_solicitud uuid, p_acepta boolean) returns void language plpgsql security definer set search_path = public as $$
begin
 if auth.uid() is null then raise exception 'Necesitas iniciar sesion'; end if;
 if not exists(select 1 from contacts where id=p_solicitud and addressee_id=auth.uid() and status='pendiente') then raise exception 'No podes responder esta solicitud'; end if;
 if p_acepta then update contacts set status='aceptado', responded_at=now() where id=p_solicitud; else delete from contacts where id=p_solicitud; end if;
end $$;
create or replace function public.quitar_contacto(p_otro uuid) returns void language plpgsql security definer set search_path = public as $$
begin delete from contacts where ((requester_id=auth.uid() and addressee_id=p_otro) or (requester_id=p_otro and addressee_id=auth.uid())); end $$;
create or replace function public.mis_contactos() returns table(contact_id uuid,user_id uuid,full_name text,avatar_url text,estado text) language sql stable security definer set search_path=public as $$
 select c.id, case when c.requester_id=auth.uid() then c.addressee_id else c.requester_id end, p.full_name,p.avatar_url,
 case when c.status='aceptado' then 'aceptado' when c.addressee_id=auth.uid() then 'recibida' else 'enviada' end
 from contacts c join profiles p on p.id=case when c.requester_id=auth.uid() then c.addressee_id else c.requester_id end
 where auth.uid() is not null and auth.uid() in(c.requester_id,c.addressee_id) and not bloqueado(c.requester_id,c.addressee_id)
$$;
create or replace function public.buscar_usuarios(p_texto text) returns table(user_id uuid,full_name text,avatar_url text,estado text) language sql stable security definer set search_path=public as $$
 with q as (select trim(p_texto) t, regexp_replace(p_texto,'[^0-9]','','g') digits), candidatos as (
 select p.id,p.full_name,p.avatar_url from profiles p left join profile_private pv on pv.user_id=p.id cross join q
 where auth.uid() is not null and p.id<>auth.uid() and not bloqueado(auth.uid(),p.id)
 and (char_length(q.digits)>=8 and right(regexp_replace(coalesce(pv.phone,''),'[^0-9]','','g'),8)=right(q.digits,8) or char_length(q.t)>=3 and p.full_name ilike '%'||q.t||'%') limit 20)
 select x.id,x.full_name,x.avatar_url, case when c.status='aceptado' then 'aceptado' when c.addressee_id=auth.uid() then 'recibida' when c.requester_id=auth.uid() then 'enviada' end
 from candidatos x left join contacts c on (c.requester_id=auth.uid() and c.addressee_id=x.id) or (c.requester_id=x.id and c.addressee_id=auth.uid())
$$;
revoke all on table public.contacts from public, anon, authenticated;
revoke all on function public.es_contacto(uuid,uuid), public.solicitar_contacto(uuid), public.responder_contacto(uuid,boolean), public.quitar_contacto(uuid), public.mis_contactos(), public.buscar_usuarios(text) from public, anon, authenticated;
grant execute on function public.es_contacto(uuid,uuid), public.solicitar_contacto(uuid), public.responder_contacto(uuid,boolean), public.quitar_contacto(uuid), public.mis_contactos(), public.buscar_usuarios(text) to authenticated;
