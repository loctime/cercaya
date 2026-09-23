-- Textos del cierre del trabajo en criollo (revisión de agy 23/09/2026):
-- el cliente no "recibe el pago", confirma que el trabajo quedó terminado.
-- Misma lógica que 0004; solo cambian los mensajes. create or replace
-- conserva los permisos de 0090.

create or replace function public.marcar_realizado(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.assigned_provider_id is distinct from auth.uid()
     or job.status <> 'asignado' then
    raise exception 'No podés marcar este trabajo';
  end if;
  update jobs set provider_done_at = now(), status = 'realizado' where id = p_job;
  perform mensaje_sistema(p_job, job.client_id, auth.uid(), 'El prestador marcó el trabajo como terminado');
  if job.client_confirmed_at is null then
    perform encolar_notificacion(job.client_id, 'estado_pedido', 'Confirmá el trabajo',
      'El prestador marcó "' || job.title || '" como terminado', jsonb_build_object('job_id', p_job));
  end if;
  perform cerrar_si_corresponde(p_job);
end
$$;

create or replace function public.confirmar_trabajo(p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job jobs;
begin
  select * into job from jobs where id = p_job;
  if job is null or job.client_id <> auth.uid()
     or job.status not in ('asignado', 'realizado') or job.client_confirmed_at is not null then
    raise exception 'No podés confirmar este trabajo';
  end if;
  update jobs set client_confirmed_at = now() where id = p_job;
  perform mensaje_sistema(p_job, job.client_id, job.assigned_provider_id,
    'El cliente confirmó que el trabajo quedó terminado');
  if job.provider_done_at is null then
    perform encolar_notificacion(job.assigned_provider_id, 'estado_pedido', 'El cliente confirmó el trabajo',
      'Marcá "trabajo terminado" para cerrarlo', jsonb_build_object('job_id', p_job));
  end if;
  perform cerrar_si_corresponde(p_job);
end
$$;
