-- =====================================================================
-- Permisos centralizados.
--
-- Supabase da por defecto TODO a anon/authenticated sobre tablas y
-- funciones nuevas del esquema public. Aca se saca todo y se da solo lo
-- necesario, columna por columna donde importa. RLS filtra filas; estos
-- grants filtran que operaciones y que columnas.
--
-- OJO en migraciones futuras: cada tabla o funcion nueva vuelve a nacer
-- con todos los permisos en Supabase. Revocar y otorgar explicito.
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Lectura publica (invitados incluidos)
grant select on public.zones, public.profiles, public.categories, public.provider_profiles,
                public.provider_services, public.provider_photos, public.reviews
  to anon, authenticated;

-- Perfil
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant select on public.profile_private to authenticated;
grant update (phone, show_phone, phone_radius_km, location_precision) on public.profile_private to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select on public.notification_prefs to authenticated;
grant update (pedidos_cerca, pedidos_radio_km, mensajes, estado_pedidos, resenas)
  on public.notification_prefs to authenticated;
grant select, insert, delete on public.push_tokens to authenticated;
grant select on public.notifications to authenticated;

-- Prestador (el estado de aprobacion NO es editable por el usuario)
grant insert (user_id, bio, price_range, coverage_radius_km, is_active) on public.provider_profiles to authenticated;
grant update (bio, price_range, coverage_radius_km, is_active) on public.provider_profiles to authenticated;
grant insert, delete on public.provider_services to authenticated;
grant insert (user_id, storage_path, caption, position) on public.provider_photos to authenticated;
grant update (caption, position) on public.provider_photos to authenticated;
grant delete on public.provider_photos to authenticated;

-- Pedidos y chat (escrituras por funciones, salvo fotos y mensajes)
grant select on public.jobs, public.job_private, public.applications, public.conversations to authenticated;
grant select, delete on public.job_photos to authenticated;
grant insert (job_id, storage_path, position) on public.job_photos to authenticated;
-- Del check-in: horario y distancia, nunca la posicion cruda.
grant select (job_id, provider_id, arrived_at, arrive_distance_m, left_at, leave_distance_m)
  on public.job_checkins to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

-- Moderacion
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, detail) on public.reports to authenticated;

-- Funciones usadas dentro de policies: las ejecuta el rol que consulta.
grant execute on function
  public.es_admin(), public.bloqueado(uuid, uuid), public.prestador_visible(uuid),
  public.es_miembro(uuid), public.es_cliente_de(uuid), public.me_ofreci(uuid)
  to anon, authenticated;

-- Consultas abiertas a invitados
grant execute on function
  public.buscar_prestadores(int, text, text, float8, float8, int, int, int),
  public.perfil_prestador(uuid, float8, float8),
  public.obtener_contacto(uuid)      -- invitados reciben motivo 'sin_sesion'
  to anon, authenticated;

-- Acciones de usuarios logueados
grant execute on function
  public.set_mi_ubicacion(float8, float8),
  public.marcar_notificaciones_leidas(),
  public.registrar_evento(uuid, text),
  public.pedidos_cerca(boolean, int),
  public.distancia_a_pedido(uuid),
  public.publicar_pedido(int, text, text, text, date, float8, float8, text),
  public.abrir_chat(uuid, uuid),
  public.compartir_contacto(uuid),
  public.marcar_leidos(uuid),
  public.ocultar_chat(uuid),
  public.me_interesa(uuid, text),
  public.asignar_prestador(uuid, uuid),
  public.checkin(uuid, float8, float8),
  public.checkout(uuid, float8, float8),
  public.marcar_realizado(uuid),
  public.confirmar_trabajo(uuid),
  public.cancelar_pedido(uuid),
  public.calificar(uuid, int, text),
  public.borrar_mi_cuenta(),
  public.admin_estado_prestador(uuid, text),
  public.admin_resolver_denuncia(uuid, text)
  to authenticated;
