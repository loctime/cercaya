-- Contraseña de los usuarios demo: variable demo_password (psql -v demo_password=...).
-- NO poner la contraseña real acá: el repo es público. La vigente está en
-- ~/.claude/credenciales/cercaya/demo-password.txt (PC de Diego, fuera del repo).
-- Datos de DEMOSTRACION en produccion (aprobado por Diego 23/09/2026).
-- Todos los usuarios usan email @cercaya.test. Se borran con borrar_demo.sql.
-- Telefonos ocultos: con numeros inventados, el boton de WhatsApp le
-- escribiria a un desconocido real.
begin;

create temp table demo (email text, nombre text, lat float8, lng float8, cats int[], bio text, precios text, radio int) on commit drop;
insert into demo values
 ('demo-plomero@cercaya.test',  'Carlos Gómez',   -33.4870, -60.0120, '{4}',   'Plomero matriculado con 15 años de experiencia. Pérdidas, termotanques, destapaciones e instalaciones nuevas.', 'Visita $8.000, presupuesto sin cargo', 20),
 ('demo-electricista@cercaya.test','Laura Fernández',-33.4790, -60.0210, '{5}', 'Electricista. Instalaciones domiciliarias, tableros, disyuntores y reparaciones urgentes.', 'Desde $10.000 la visita', 25),
 ('demo-jardinero@cercaya.test', 'Martín Ruiz',    -33.5040, -60.0600, '{1,2,3}', 'Corte de pasto, poda y limpieza de terrenos. Tengo desmalezadora y motosierra.', 'Corte de pasto desde $15.000', 15),
 ('demo-pintor@cercaya.test',    'Diego Sosa',     -33.4850, -60.0180, '{6,7}', 'Pintura de interiores y exteriores, impermeabilización de techos y arreglos de albañilería.', 'Presupuesto por m², sin cargo', 20),
 ('demo-cliente1@cercaya.test',  'Ana Martínez',   -33.4820, -60.0150, null, null, null, null),
 ('demo-cliente2@cercaya.test',  'Jorge Pereyra',  -33.5010, -60.0580, null, null, null, null);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       email, jsonb_build_object('full_name', nombre), now() - interval '20 days', now()
  from demo;

update profile_private pv set lat = d.lat, lng = d.lng, location_updated_at = now()
  from demo d join auth.users u on u.email = d.email where pv.user_id = u.id;

insert into provider_profiles (user_id, bio, price_range, coverage_radius_km, status, approved_at)
select u.id, d.bio, d.precios, d.radio, 'aprobado', now()
  from demo d join auth.users u on u.email = d.email where d.cats is not null;

insert into provider_services (user_id, category_id)
select u.id, unnest(d.cats) from demo d join auth.users u on u.email = d.email where d.cats is not null;

-- Trabajos cerrados con resenas, para que se vean calificaciones.
create temp table trabajos (cliente text, prestador text, cat int, titulo text, rating int, comentario text, verificado boolean, hace int) on commit drop;
insert into trabajos values
 ('demo-cliente1@cercaya.test','demo-plomero@cercaya.test',4,'Pérdida en el baño',5,'Vino en el día, encontró la pérdida y dejó todo limpio. Muy recomendable.',true,12),
 ('demo-cliente2@cercaya.test','demo-plomero@cercaya.test',4,'Cambio de termotanque',4,'Buen trabajo, llegó un poco más tarde de lo acordado.',false,8),
 ('demo-cliente1@cercaya.test','demo-jardinero@cercaya.test',1,'Corte de pasto del fondo',5,'Impecable, y el precio justo.',true,5),
 ('demo-cliente2@cercaya.test','demo-electricista@cercaya.test',5,'Saltaba el disyuntor',5,'Lo resolvió rápido y me explicó qué pasaba.',false,3);

with nuevos as (
  insert into jobs (client_id, category_id, title, description, urgency, zone_label, approx_lat, approx_lng,
                    status, assigned_provider_id, assigned_at, provider_done_at, client_confirmed_at, closed_at, created_at)
  select c.id, t.cat, t.titulo, t.titulo || ' (pedido de demostración).', 'semana',
         zona_de(pc.lat, pc.lng), round(pc.lat::numeric, 2), round(pc.lng::numeric, 2),
         'cerrado', p.id, now() - (t.hace || ' days')::interval, now() - (t.hace || ' days')::interval,
         now() - (t.hace || ' days')::interval, now() - (t.hace || ' days')::interval,
         now() - ((t.hace + 1) || ' days')::interval
    from trabajos t
    join auth.users c on c.email = t.cliente
    join auth.users p on p.email = t.prestador
    join profile_private pc on pc.user_id = c.id
  returning id, client_id, assigned_provider_id, title
)
insert into reviews (job_id, reviewer_id, reviewee_id, rol_calificado, rating, comment, trabajo_verificado, created_at)
select n.id, n.client_id, n.assigned_provider_id, 'prestador', t.rating, t.comentario, t.verificado,
       now() - (t.hace || ' days')::interval
  from nuevos n
  join auth.users c on c.id = n.client_id
  join auth.users p on p.id = n.assigned_provider_id
  join trabajos t on t.cliente = c.email and t.prestador = p.email and t.titulo = n.title;

-- job_private (la ubicacion exacta del pedido = la del cliente)
insert into job_private (job_id, lat, lng)
select j.id, pv.lat, pv.lng from jobs j join profile_private pv on pv.user_id = j.client_id
 where j.client_id in (select id from auth.users where email like '%@cercaya.test')
   and not exists (select 1 from job_private x where x.job_id = j.id);

-- Filas de auth completas: sin estos campos en texto vacio el login da
-- "Database error querying schema".
update auth.users set confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''), phone_change = coalesce(phone_change, ''), phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''), email_confirmed_at = coalesce(email_confirmed_at, now()),
  encrypted_password = extensions.crypt(:'demo_password', extensions.gen_salt('bf'))
 where email like '%@cercaya.test';
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u where u.email like '%@cercaya.test'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

commit;
