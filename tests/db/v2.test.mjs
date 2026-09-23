import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { crearDb, RAMALLO, CERCA, VILLA, ROSARIO } from './harness.mjs'

const PLOMERIA = 4
const PINTURA = 6
let db

before(async () => { db = await crearDb() })
after(async () => { await db.cerrar() })

const rechaza = (p, re) => assert.rejects(p, re)

test('alta de usuario crea perfil, datos privados y preferencias', async () => {
  const id = await db.usuario('Ana Alta', { phone: '3407 123456', ...RAMALLO })
  const p = await db.uno('select * from profiles where id = $1', [id])
  assert.equal(p.full_name, 'Ana Alta')
  assert.equal(p.zone_label, 'Ramallo')
  assert.equal(Number(p.approx_lat), -33.48)
  const pv = await db.uno('select * from profile_private where user_id = $1', [id])
  assert.equal(pv.show_phone, false, 'el numero arranca oculto')
  assert.equal(pv.phone_radius_km, 30)
  assert.ok(await db.uno('select 1 from notification_prefs where user_id = $1', [id]))
})

test('privacidad: nadie lee datos privados ajenos ni se hace admin', async () => {
  const yo = await db.usuario('Priv Uno', { phone: '3407222222', ...RAMALLO })
  const otro = await db.usuario('Priv Dos', { phone: '3407333333', ...RAMALLO })
  await rechaza(db.como(null, (d) => d.sql('select * from profile_private')), /permission denied/)
  const filas = await db.como(yo, (d) => d.sql('select * from profile_private'))
  assert.deepEqual(filas.map((f) => f.user_id), [yo])
  await rechaza(db.como(yo, (d) => d.sql('update profiles set is_admin = true where id = $1', [yo])), /permission denied/)
  await rechaza(db.como(yo, (d) => d.sql('update profile_private set lat = 0 where user_id = $1', [yo])), /permission denied/)
  const n = await db.como(yo, (d) => d.sql('update profile_private set phone = $2 where user_id = $1 returning 1', [otro, '1']))
  assert.equal(n.length, 0)
})

test('prestador no se puede autoaprobar; el admin si', async () => {
  const u = await db.usuario('Auto Aprobado', RAMALLO)
  await rechaza(
    db.como(u, (d) => d.sql(`insert into provider_profiles (user_id, status) values ($1, 'aprobado')`, [u])),
    /permission denied/,
  )
  await db.como(u, (d) => d.sql(`insert into provider_profiles (user_id, bio) values ($1, 'Plomero')`, [u]))
  await db.como(u, (d) => d.sql(`insert into provider_services (user_id, category_id) values ($1, $2)`, [u, PLOMERIA]))
  const antes = await db.como(null, (d) => d.sql('select * from buscar_prestadores(p_categoria := $1)', [PLOMERIA]))
  assert.ok(!antes.some((r) => r.user_id === u), 'pendiente no aparece')

  await rechaza(db.como(u, (d) => d.sql(`select admin_estado_prestador($1, 'aprobado')`, [u])), /Solo administradores/)
  const admin = await db.usuario('Admin')
  await db.sql('update profiles set is_admin = true where id = $1', [admin])
  await db.como(admin, (d) => d.sql(`select admin_estado_prestador($1, 'aprobado')`, [u]))
  const despues = await db.como(null, (d) => d.sql('select * from buscar_prestadores(p_categoria := $1)', [PLOMERIA]))
  assert.ok(despues.some((r) => r.user_id === u), 'aprobado aparece')
})

test('busqueda: invitados ven distancia redondeada, sin coordenadas; respeta cobertura y bloqueos', async () => {
  const cerca = await db.prestador('Pepe Cerca', { categorias: [PINTURA], ...CERCA })
  const villa = await db.prestador('Pepe Villa', { categorias: [PINTURA], ...VILLA, radio: 3 })
  const r = await db.como(null, (d) => d.sql('select * from buscar_prestadores(p_categoria := $1, p_lat := $2, p_lng := $3)',
    [PINTURA, RAMALLO.lat, RAMALLO.lng]))
  const fila = r.find((x) => x.user_id === cerca)
  assert.ok(fila)
  assert.equal(Number(fila.distancia_km), 0, 'menos de 1 km')
  assert.equal(fila.contacto, 'chat', 'numero oculto -> chat')
  assert.ok(!('lat' in fila) && !('approx_lat' in fila))
  assert.ok(!r.some((x) => x.user_id === villa), 'fuera de su radio de cobertura')

  const texto = await db.como(null, (d) => d.sql(`select user_id from buscar_prestadores(p_texto := 'pintura')`))
  assert.ok(texto.some((x) => x.user_id === cerca), 'busca por nombre de rubro sin tildes')

  const cliente = await db.usuario('Cliente Bloqueador', RAMALLO)
  await db.como(cliente, (d) => d.sql('insert into blocks (blocker_id, blocked_id) values ($1, $2)', [cliente, cerca]))
  const r2 = await db.como(cliente, (d) => d.sql('select user_id from buscar_prestadores(p_categoria := $1)', [PINTURA]))
  assert.ok(!r2.some((x) => x.user_id === cerca), 'bloqueado no aparece')
})

test('telefono: solo logueados, visible, cerca y sin bloqueo', async () => {
  const p = await db.prestador('Tel Prestador', { ...RAMALLO, showPhone: true, phone: '3407444444' })
  const vecino = await db.usuario('Tel Vecino', CERCA)
  const lejano = await db.usuario('Tel Lejano', ROSARIO)
  const sinUbi = await db.usuario('Tel SinUbi')
  const c = (u) => db.como(u, (d) => d.uno('select obtener_contacto($1) as r', [p])).then((x) => x.r)

  assert.equal((await c(null)).motivo, 'sin_sesion')
  assert.deepEqual(await c(vecino), { ok: true, telefono: '3407444444' })
  assert.equal((await c(lejano)).motivo, 'lejos')
  assert.equal((await c(sinUbi)).motivo, 'sin_ubicacion')

  await db.sql('update profile_private set phone_radius_km = 100 where user_id = $1', [p])
  assert.equal((await c(lejano)).ok, true, 'el duenio puede ampliar el radio')

  await db.sql('update profile_private set show_phone = false where user_id = $1', [p])
  assert.equal((await c(vecino)).motivo, 'oculto')
  const ev = await db.uno(`select count(*)::int n from contact_events where target_id = $1 and kind = 'revelar_telefono'`, [p])
  assert.equal(ev.n, 2)
})

test('ciclo completo del pedido, chat y resenas', async () => {
  const cliente = await db.usuario('Cli Ciclo', { phone: '3407555555', ...RAMALLO })
  const plomero = await db.prestador('Plo Ciclo', { ...CERCA })
  const intruso = await db.usuario('Intruso', RAMALLO)

  const job = (await db.como(cliente, (d) => d.uno(
    `select publicar_pedido($1, 'Canilla rota', 'Pierde agua la canilla de la cocina', 'hoy') as id`, [PLOMERIA]))).id

  // Notificacion al plomero cercano
  const notif = await db.uno(`select * from notifications where user_id = $1 and kind = 'pedido_cerca'`, [plomero])
  assert.equal(notif.data.job_id, job)

  // Invitado no ve pedidos; otro usuario lo ve sin ubicacion exacta
  assert.equal((await db.como(null, (d) => d.sql('select * from jobs').catch(() => []))).length, 0)
  const visto = await db.como(intruso, (d) => d.sql('select * from jobs where id = $1', [job]))
  assert.equal(visto.length, 1)
  assert.equal((await db.como(intruso, (d) => d.sql('select * from job_private'))).length, 0)
  const lista = await db.como(plomero, (d) => d.sql('select * from pedidos_cerca()'))
  assert.equal(lista[0].id, job)
  assert.equal(Number(lista[0].distancia_km), 0)

  // Solo prestadores aprobados del rubro pueden ofrecerse
  await rechaza(db.como(intruso, (d) => d.sql('select me_interesa($1)', [job])), /aprobado/)
  const conv = (await db.como(plomero, (d) => d.uno(`select me_interesa($1, 'Hola, paso hoy') as c`, [job]))).c
  assert.equal((await db.uno('select status from jobs where id = $1', [job])).status, 'en_conversacion')

  // Chat: no se puede falsificar un mensaje de contacto ni escribir en chat ajeno
  await rechaza(db.como(cliente, (d) => d.sql(
    `insert into messages (conversation_id, sender_id, body, kind) values ($1, $2, 'x', 'contacto')`, [conv, cliente])), /permission denied/)
  await rechaza(db.como(intruso, (d) => d.sql(
    `insert into messages (conversation_id, sender_id, body) values ($1, $2, 'hola')`, [conv, intruso])), /row-level security/)
  await db.como(cliente, (d) => d.sql(`insert into messages (conversation_id, sender_id, body) values ($1, $2, 'Dale')`, [conv, cliente]))
  await db.como(cliente, (d) => d.sql('select compartir_contacto($1)', [conv]))
  const msj = await db.como(plomero, (d) => d.sql(`select * from messages where conversation_id = $1 and kind = 'contacto'`, [conv]))
  assert.equal(msj[0].contact_phone, '3407555555')

  // Asignar, check-in (posicion cruda no visible), cierre doble
  await rechaza(db.como(cliente, (d) => d.sql('select asignar_prestador($1, $2)', [job, intruso])), /hablaste/)
  await db.como(cliente, (d) => d.sql('select asignar_prestador($1, $2)', [job, plomero]))
  await rechaza(db.como(plomero, (d) => d.sql('select calificar($1, 5)', [job])), /terminados/)
  const dist = (await db.como(plomero, (d) => d.uno('select checkin($1, $2, $3) as m', [job, RAMALLO.lat, RAMALLO.lng]))).m
  assert.equal(dist, 0)
  await rechaza(db.como(cliente, (d) => d.sql('select arrive_lat from job_checkins')), /permission denied/)
  assert.equal((await db.como(cliente, (d) => d.sql('select arrive_distance_m from job_checkins'))).length, 1)
  await db.como(plomero, (d) => d.sql('select checkout($1, $2, $3)', [job, RAMALLO.lat, RAMALLO.lng]))

  await db.como(plomero, (d) => d.sql('select marcar_realizado($1)', [job]))
  assert.equal((await db.uno('select status from jobs where id = $1', [job])).status, 'realizado')
  await db.como(cliente, (d) => d.sql('select confirmar_trabajo($1)', [job]))
  assert.equal((await db.uno('select status from jobs where id = $1', [job])).status, 'cerrado')

  // Resenas en las dos direcciones, una sola vez
  await db.como(cliente, (d) => d.sql(`select calificar($1, 5, 'Excelente')`, [job]))
  await db.como(plomero, (d) => d.sql('select calificar($1, 4)', [job]))
  await rechaza(db.como(cliente, (d) => d.sql('select calificar($1, 1)', [job])), /Ya calificaste/)
  await rechaza(db.como(intruso, (d) => d.sql('select calificar($1, 1)', [job])), /No participaste/)
  const rev = await db.uno(`select * from reviews where job_id = $1 and rol_calificado = 'prestador'`, [job])
  assert.equal(rev.trabajo_verificado, false, 'checkout inmediato: menos de 10 minutos')

  // Metricas en el perfil publico
  const perfil = (await db.como(null, (d) => d.uno('select perfil_prestador($1) as p', [plomero]))).p
  assert.equal(perfil.trabajos_realizados, 1)
  assert.equal(Number(perfil.calificacion), 5)
  assert.equal(perfil.contactos_recibidos, 0, "el chat lo abrio el prestador: no cuenta como contacto recibido")
})

test('trabajo verificado: llego cerca y se quedo 10 minutos', async () => {
  const cliente = await db.usuario('Cli Verif', RAMALLO)
  const plomero = await db.prestador('Plo Verif', { ...CERCA })
  const job = (await db.como(cliente, (d) => d.uno(
    `select publicar_pedido($1, 'Inodoro', 'El inodoro pierde agua todo el tiempo', 'semana') as id`, [PLOMERIA]))).id
  await db.como(plomero, (d) => d.sql('select me_interesa($1)', [job]))
  await db.como(cliente, (d) => d.sql('select asignar_prestador($1, $2)', [job, plomero]))
  await db.como(plomero, (d) => d.sql('select checkin($1, $2, $3)', [job, RAMALLO.lat, RAMALLO.lng]))
  await db.sql(`update job_checkins set arrived_at = now() - interval '30 minutes' where job_id = $1`, [job])
  await db.como(plomero, (d) => d.sql('select checkout($1, $2, $3)', [job, RAMALLO.lat, RAMALLO.lng]))
  await db.como(cliente, (d) => d.sql('select confirmar_trabajo($1)', [job]))
  await db.como(plomero, (d) => d.sql('select marcar_realizado($1)', [job]))
  await db.como(cliente, (d) => d.sql('select calificar($1, 5)', [job]))
  const rev = await db.uno(`select trabajo_verificado from reviews where job_id = $1`, [job])
  assert.equal(rev.trabajo_verificado, true)
})

test('bloqueo corta el chat y las preferencias apagan notificaciones', async () => {
  const a = await db.usuario('Blo A', RAMALLO)
  const b = await db.usuario('Blo B', RAMALLO)
  const conv = (await db.como(a, (d) => d.uno('select abrir_chat($1) as c', [b]))).c
  await db.como(b, (d) => d.sql(`update notification_prefs set mensajes = false where user_id = $1`, [b]))
  await db.como(a, (d) => d.sql(`insert into messages (conversation_id, sender_id, body) values ($1, $2, 'hola')`, [conv, a]))
  const n = await db.uno(`select count(*)::int n from notifications where user_id = $1 and kind = 'mensaje'`, [b])
  assert.equal(n.n, 0)
  await db.como(b, (d) => d.sql('insert into blocks (blocker_id, blocked_id) values ($1, $2)', [b, a]))
  await rechaza(db.como(a, (d) => d.sql(
    `insert into messages (conversation_id, sender_id, body) values ($1, $2, 'hola?')`, [conv, a])), /No podes/)
  await rechaza(db.como(a, (d) => d.sql('select abrir_chat($1)', [b])), /No podes/)
})

test('denuncias: se crean y solo las ve quien denuncio o un admin', async () => {
  const a = await db.usuario('Den A')
  const b = await db.usuario('Den B')
  await db.como(a, (d) => d.sql(
    `insert into reports (reporter_id, target_type, target_id, reason) values ($1, 'perfil', $2, 'estafa')`, [a, b]))
  assert.equal((await db.como(a, (d) => d.sql('select * from reports'))).length, 1)
  assert.equal((await db.como(b, (d) => d.sql('select * from reports'))).length, 0)
  await rechaza(db.como(a, (d) => d.sql(
    `insert into reports (reporter_id, target_type, target_id, reason, status) values ($1, 'perfil', $2, 'spam', 'revisada')`, [a, b])), /permission denied/)
})

test('borrar mi cuenta: se va todo lo suyo y sus resenas quedan anonimas', async () => {
  const cliente = await db.usuario('Cli Borra', RAMALLO)
  const plomero = await db.prestador('Plo Borra', { ...CERCA })
  const job = (await db.como(cliente, (d) => d.uno(
    `select publicar_pedido($1, 'Termotanque', 'No calienta el agua del termotanque', 'hoy') as id`, [PLOMERIA]))).id
  await db.como(plomero, (d) => d.sql('select me_interesa($1)', [job]))
  await db.como(cliente, (d) => d.sql('select asignar_prestador($1, $2)', [job, plomero]))
  await db.como(plomero, (d) => d.sql('select marcar_realizado($1)', [job]))
  await db.como(cliente, (d) => d.sql('select confirmar_trabajo($1)', [job]))
  await db.como(plomero, (d) => d.sql('select calificar($1, 5)', [job]))

  await db.como(plomero, (d) => d.sql('select borrar_mi_cuenta()'))
  assert.equal((await db.sql('select * from profiles where id = $1', [plomero])).length, 0)
  assert.equal((await db.sql('select * from provider_profiles where user_id = $1', [plomero])).length, 0)
  const rev = await db.uno('select * from reviews where job_id = $1', [job])
  assert.equal(rev.reviewer_id, null, 'resena anonima')
  const job2 = await db.uno('select assigned_provider_id from jobs where id = $1', [job])
  assert.equal(job2.assigned_provider_id, null)
})

test('limite de 5 pedidos por dia', async () => {
  const u = await db.usuario('Spammer', RAMALLO)
  for (let i = 0; i < 5; i++) {
    await db.como(u, (d) => d.sql(`select publicar_pedido($1, 'Pedido ' || $2, 'Descripcion suficientemente larga', 'hoy')`, [PLOMERIA, i]))
  }
  await rechaza(db.como(u, (d) => d.sql(`select publicar_pedido($1, 'Otro', 'Descripcion suficientemente larga', 'hoy')`, [PLOMERIA])), /limite/)
})

test('mis chats: ultimo mensaje, no leidos, ocultos y bloqueados', async () => {
  const a = await db.usuario('Chat A', RAMALLO)
  const b = await db.usuario('Chat B', RAMALLO)
  const c = await db.usuario('Chat C', RAMALLO)
  const conv = (await db.como(a, (d) => d.uno('select abrir_chat($1) as c', [b]))).c
  const conv2 = (await db.como(a, (d) => d.uno('select abrir_chat($1) as c', [c]))).c
  await db.como(b, (d) => d.sql(`insert into messages (conversation_id, sender_id, body) values ($1, $2, 'hola A')`, [conv, b]))
  await db.como(b, (d) => d.sql(`insert into messages (conversation_id, sender_id, body) values ($1, $2, 'estas?')`, [conv, b]))

  let chats = await db.como(a, (d) => d.sql('select * from mis_chats()'))
  const fila = chats.find((x) => x.id === conv)
  assert.equal(fila.otro_nombre, 'Chat B')
  assert.equal(fila.ultimo_texto, 'estas?')
  assert.equal(fila.ultimo_mio, false)
  assert.equal(Number(fila.sin_leer), 2)

  await db.como(a, (d) => d.sql('select marcar_leidos($1)', [conv]))
  chats = await db.como(a, (d) => d.sql('select * from mis_chats()'))
  assert.equal(Number(chats.find((x) => x.id === conv).sin_leer), 0)

  await db.como(a, (d) => d.sql('select ocultar_chat($1)', [conv2]))
  chats = await db.como(a, (d) => d.sql('select id from mis_chats()'))
  assert.ok(!chats.some((x) => x.id === conv2), 'oculto no aparece')

  await db.como(a, (d) => d.sql('insert into blocks (blocker_id, blocked_id) values ($1, $2)', [a, b]))
  chats = await db.como(a, (d) => d.sql('select id from mis_chats()'))
  assert.ok(!chats.some((x) => x.id === conv), 'bloqueado no aparece')
  assert.equal((await db.como(c, (d) => d.sql('select * from mis_chats()'))).length, 1, 'el otro lo sigue viendo')
  await rechaza(db.como(null, (d) => d.sql('select * from mis_chats()')), /permission denied/)
})

test('push: el token pasa a quien inicia sesion en ese celular', async () => {
  const a = await db.usuario('Push A')
  const b = await db.usuario('Push B')
  const token = 'ExponentPushToken[abc123]'
  await db.como(a, (d) => d.sql(`select registrar_push_token($1, 'android')`, [token]))
  assert.equal((await db.uno('select user_id from push_tokens where token = $1', [token])).user_id, a)
  await db.como(b, (d) => d.sql(`select registrar_push_token($1, 'android')`, [token]))
  const filas = await db.sql('select user_id from push_tokens where token = $1', [token])
  assert.deepEqual(filas.map((f) => f.user_id), [b], 'un celular, una cuenta')
  await rechaza(db.como(a, (d) => d.sql(`select registrar_push_token('cualquier cosa', 'android')`)), /Token invalido/)
  await rechaza(db.como(null, (d) => d.sql(`select registrar_push_token($1, 'android')`, [token])), /permission denied/)
  // Sin pg_net (PGlite) el aviso se guarda igual y queda sin enviar.
  await db.sql(`select encolar_notificacion($1, 'sistema', 'Hola', 'Prueba')`, [b])
  const n = await db.uno(`select sent_at from notifications where user_id = $1`, [b])
  assert.equal(n.sent_at, null)
})
