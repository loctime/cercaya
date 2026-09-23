-- =====================================================================
-- Lista de chats en una sola consulta + mensajes en tiempo real.
-- =====================================================================

create or replace function public.mis_chats()
returns table (
  id            uuid,
  job_id        uuid,
  job_title     text,
  otro_id       uuid,
  otro_nombre   text,
  otro_avatar   text,
  ultimo_texto  text,
  ultimo_kind   text,
  ultimo_mio    boolean,
  ultimo_at     timestamptz,
  sin_leer      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.job_id, j.title,
         o.id, o.full_name, o.avatar_url,
         m.body, m.kind, m.sender_id = auth.uid(), coalesce(m.created_at, c.created_at),
         (select count(*) from messages x
           where x.conversation_id = c.id and x.read_at is null
             and x.sender_id is not null and x.sender_id <> auth.uid())
    from conversations c
    join profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    left join jobs j on j.id = c.job_id
    left join lateral (
      select body, kind, sender_id, created_at from messages
       where conversation_id = c.id order by created_at desc limit 1
    ) m on true
   where auth.uid() in (c.user_a, c.user_b)
     and not (case when c.user_a = auth.uid() then c.hidden_a else c.hidden_b end)
     and not bloqueado(c.user_a, c.user_b)
   order by coalesce(m.created_at, c.created_at) desc
$$;

revoke execute on function public.mis_chats() from public, anon;
grant execute on function public.mis_chats() to authenticated;

-- Tiempo real para mensajes (Supabase Realtime respeta la RLS de messages).
-- En PGlite no existe la publicacion: se saltea.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
