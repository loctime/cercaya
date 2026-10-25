// Bots de prueba de CercaYa (red social con mapa). Corren contra PRODUCCION.
// Todos son bot-*@cercaya.test: `limpiar` los borra (y por cascada sus contactos,
// chats y encuentros). La contrasenia NO va en el repo (es publico): se lee de
// ~/.claude/credenciales/cercaya/demo-password.txt.
//
//   node scripts/bots.mjs sembrar            crea/actualiza los 8 bots y su relacion con Diego
//   node scripts/bots.mjs correr             los bots responden solos (contactos, encuentros, chat)
//   node scripts/bots.mjs estado             resumen de lo que hay
//   node scripts/bots.mjs pedir <bot>        el bot le pide un encuentro a Diego (60 min)
//   node scripts/bots.mjs msg <bot> <texto>  el bot le escribe a Diego
//   node scripts/bots.mjs solicitar <bot>    el bot le manda solicitud de contacto a Diego
//   node scripts/bots.mjs buscar <bot> <texto>  busca servicios (modo Trabajo) como ese bot
//   node scripts/bots.mjs limpiar            borra los bots
import fs from 'node:fs'
import os from 'node:os'

const REF = 'jmgoquaxvmzqjkrnfcwo'
const SB = `https://${REF}.supabase.co`
const DIEGO = 'basebalbuss@gmail.com'
const HOME = os.homedir()
const settings = JSON.parse(fs.readFileSync(`${HOME}/.claude/settings.json`, 'utf8'))
const PASSWORD = fs.readFileSync(`${HOME}/.claude/credenciales/cercaya/demo-password.txt`, 'utf8').trim()
// movil/.env no se versiona: en un worktree puede faltar, se prueba tambien el del repo principal.
const envPath = ['../movil/.env', '../../CercaYa/movil/.env'].map((p) => new URL(p, import.meta.url)).find((p) => fs.existsSync(p))
const ANON = fs.readFileSync(envPath, 'utf8').match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()

// Diego esta en Ramallo; los bots se ubican alrededor (1 km ~ 0,009 grados).
const BASE = { lat: -33.4766, lng: -60.0041 }
// rel: contacto (aceptado) | recibida (el bot le pide a Diego) | enviada (Diego le pide al bot) | ninguna
const BOTS = [
  { k: 'lucia',     email: 'bot-lucia@cercaya.test',     nombre: 'Lucía Ferreyra',  dlat: -0.0024, dlng: -0.0034, rel: 'contacto', comparte: true,  publico: false, oficio: 'Peluquera',      responde: true, ofrece: true, disponible: false,  habilidades: [['Peluquera', null, 'oficio']] },
  { k: 'mateo',     email: 'bot-mateo@cercaya.test',     nombre: 'Mateo Quiroga',   dlat: -0.0104, dlng:  0.0041, rel: 'contacto', comparte: true,  publico: false, oficio: 'Carpintero',     responde: true, ofrece: true, disponible: false,  habilidades: [['Carpintero', null, 'oficio'], ['Armar muebles', 'armar-muebles', 'tarea']] },
  { k: 'sofia',     email: 'bot-sofia@cercaya.test',     nombre: 'Sofía Álvarez',   dlat:  0.0060, dlng: -0.0090, rel: 'contacto', comparte: false, publico: false, oficio: 'Contadora',      responde: true, ofrece: false, disponible: false, habilidades: [['Contadora', null, 'oficio']] },
  { k: 'tomas',     email: 'bot-tomas@cercaya.test',     nombre: 'Tomás Benítez',   dlat:  0.0030, dlng:  0.0060, rel: 'recibida', comparte: true,  publico: false, oficio: 'Plomero',        responde: true, ofrece: true, disponible: true,  habilidades: [['Plomero', 'plomero', 'oficio'], ['Arreglar una canilla', 'arreglar-canilla', 'tarea'], ['Destapar un desagüe', 'destapar-desague', 'tarea']] },
  { k: 'valentina', email: 'bot-valentina@cercaya.test', nombre: 'Valentina Ríos',  dlat: -0.0150, dlng: -0.0120, rel: 'enviada',  comparte: true,  publico: false, oficio: 'Fotógrafa',      responde: true, ofrece: false, disponible: false, habilidades: [['Fotógrafa', null, 'oficio']] },
  { k: 'nicolas',   email: 'bot-nicolas@cercaya.test',   nombre: 'Nicolás Paz',     dlat:  0.0270, dlng:  0.0150, rel: 'ninguna',  comparte: false, publico: true,  oficio: 'Electricista',   responde: true, ofrece: true, disponible: true,  habilidades: [['Electricista', 'electricista', 'oficio'], ['Cambiar una lamparita', 'cambiar-lamparita', 'tarea']] },
  { k: 'camila',    email: 'bot-camila@cercaya.test',    nombre: 'Camila Herrera',  dlat: -0.0900, dlng:  0.0500, rel: 'ninguna',  comparte: false, publico: true,  oficio: 'Diseñadora',     responde: true, ofrece: true, disponible: false,  habilidades: [['Diseñadora', null, 'oficio']] },
  { k: 'bruno',     email: 'bot-bruno@cercaya.test',     nombre: 'Bruno Acosta',    dlat:  0.0200, dlng: -0.0200, rel: 'ninguna',  comparte: false, publico: false, oficio: null,             responde: false, ofrece: false, disponible: false, habilidades: [] },
]
const bot = (k) => BOTS.find((b) => b.k === k) ?? (console.error('Bot desconocido: ' + k + '. Hay: ' + BOTS.map((b) => b.k).join(', ')), process.exit(1))
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`SQL ${r.status}: ${JSON.stringify(j)}`)
  return j
}

// ---------------------------------------------------------------- sembrar
async function sembrar() {
  const [d] = await sql(`select id from auth.users where email = ${q(DIEGO)}`)
  if (!d) throw new Error('No encuentro a ' + DIEGO)
  const habs = BOTS.flatMap((b) => b.habilidades.map(([label, cat, tipo]) => `(${q(b.email)}, ${q(label)}, ${cat ? q(cat) : 'null'}, ${q(tipo)})`)).join(',\n')
  const filas = BOTS.map((b) => `(${q(b.email)}, ${q(b.nombre)}, ${BASE.lat + b.dlat}, ${BASE.lng + b.dlng}, ${b.comparte}, ${b.publico}, ${q(b.rel)}, ${b.oficio ? q(b.oficio) : 'null'}, ${b.ofrece}, ${b.disponible})`).join(',\n')
  await sql(`
begin;
create temp table bots (email text, nombre text, lat float8, lng float8, comparte boolean, publico boolean, rel text, oficio text, ofrece boolean, disponible boolean) on commit drop;
insert into bots values ${filas};

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       b.email, jsonb_build_object('full_name', b.nombre), now(), now()
  from bots b where not exists (select 1 from auth.users u where u.email = b.email);

update auth.users set confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''), phone_change = coalesce(phone_change, ''), phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''), email_confirmed_at = coalesce(email_confirmed_at, now()),
  encrypted_password = extensions.crypt(${q(PASSWORD)}, extensions.gen_salt('bf'))
 where email like 'bot-%@cercaya.test';
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u where u.email like 'bot-%@cercaya.test'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

update profile_private pv set lat = b.lat, lng = b.lng, location_updated_at = now(),
       share_location = b.comparte, es_publico = b.publico
  from bots b join auth.users u on u.email = b.email where pv.user_id = u.id;

delete from oficios where user_id in (select u.id from bots b join auth.users u on u.email = b.email);
${habs ? `create temp table habs (email text, label text, catalog_id text, tipo text) on commit drop;
insert into habs values ${habs};
insert into oficios (user_id, label, catalog_id, tipo)
select u.id, h.label, h.catalog_id, h.tipo from habs h join auth.users u on u.email = h.email;` : ''}

-- Modo Trabajo: "Ofrezco servicios" solo despues de cargar las habilidades (el servidor lo exige).
update profile_private pv set ofrece_servicios = b.ofrece
  from bots b join auth.users u on u.email = b.email where pv.user_id = u.id;

-- "Disponible ahora": solo los bots marcados, por 8 horas.
update profile_private pv set disponible_hasta = case when b.disponible and b.ofrece then now() + interval '8 hours' end
  from bots b join auth.users u on u.email = b.email where pv.user_id = u.id;

delete from cv_entries where user_id in (select u.id from bots b join auth.users u on u.email = b.email);
insert into cv_entries (user_id, titulo, lugar, desde_anio, descripcion)
select u.id, b.oficio, 'Ramallo', 2018, 'Experiencia de demostración (bot de prueba).'
  from bots b join auth.users u on u.email = b.email where b.oficio is not null;

-- Relacion con Diego: se rearma de cero cada vez.
delete from contacts where (requester_id = ${q(d.id)} and addressee_id in (select u.id from auth.users u where u.email like 'bot-%@cercaya.test'))
                        or (addressee_id = ${q(d.id)} and requester_id in (select u.id from auth.users u where u.email like 'bot-%@cercaya.test'));
insert into contacts (requester_id, addressee_id, status, responded_at)
select u.id, ${q(d.id)}, 'aceptado', now() from bots b join auth.users u on u.email = b.email where b.rel = 'contacto';
insert into contacts (requester_id, addressee_id, status)
select u.id, ${q(d.id)}, 'pendiente' from bots b join auth.users u on u.email = b.email where b.rel = 'recibida';
insert into contacts (requester_id, addressee_id, status)
select ${q(d.id)}, u.id, 'pendiente' from bots b join auth.users u on u.email = b.email where b.rel = 'enviada';

-- Un chat ya empezado con Lucia, con un mensaje sin leer.
insert into conversations (user_a, user_b, created_by)
select least(u.id, ${q(d.id)}::uuid), greatest(u.id, ${q(d.id)}::uuid), u.id
  from auth.users u where u.email = 'bot-lucia@cercaya.test'
   and not exists (select 1 from conversations c where c.job_id is null
        and c.user_a = least(u.id, ${q(d.id)}::uuid) and c.user_b = greatest(u.id, ${q(d.id)}::uuid));
insert into messages (conversation_id, sender_id, body)
select c.id, u.id, 'Hola Diego! Soy un bot de prueba. Respondeme y te contesto.'
  from auth.users u join conversations c on c.user_a = least(u.id, ${q(d.id)}::uuid) and c.user_b = greatest(u.id, ${q(d.id)}::uuid) and c.job_id is null
 where u.email = 'bot-lucia@cercaya.test'
   and not exists (select 1 from messages m where m.conversation_id = c.id);
commit;`)
  console.log('Sembrados 8 bots. Corré `node scripts/bots.mjs correr` para que respondan solos.')
  await estado()
}

// ---------------------------------------------------------------- sesion bot
const sesiones = {}
async function login(b) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: b.email, password: PASSWORD }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`login ${b.k}: ${JSON.stringify(j)}`)
  sesiones[b.k] = { token: j.access_token, id: j.user.id, exp: Date.now() + (j.expires_in - 60) * 1000 }
  return sesiones[b.k]
}
async function ses(b) {
  const s = sesiones[b.k]
  return s && s.exp > Date.now() ? s : login(b)
}
async function api(b, path, { method = 'GET', body } = {}) {
  const s = await ses(b)
  const r = await fetch(`${SB}${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { apikey: ANON, Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
  })
  const t = await r.text()
  const j = t ? JSON.parse(t) : null
  if (!r.ok) throw new Error(`${path} ${r.status}: ${t}`)
  return j
}
const rpc = (b, fn, args = {}) => api(b, `/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
const diegoId = async () => (await sql(`select id from auth.users where email = ${q(DIEGO)}`))[0].id

// ---------------------------------------------------------------- correr
const RESPUESTAS = ['Dale, te escucho.', 'Jaja bien ahí. ¿Y vos?', 'Anotado. Soy un bot, pero te leo igual.', 'Perfecto, quedamos así.', '¿Seguís por Ramallo?']
const GRADOS_POR_M = 1 / 111000
const posiciones = {}

async function tick(b, diego) {
  // contactos: aceptar lo que me piden (Bruno no responde nunca, para probar "pendiente")
  if (b.responde) {
    for (const c of await rpc(b, 'mis_contactos')) {
      if (c.estado === 'recibida') {
        await rpc(b, 'responder_contacto', { p_solicitud: c.contact_id, p_acepta: true })
        console.log(`${b.nombre}: aceptó la solicitud de contacto`)
      }
    }
  }
  // encuentros: aceptar y acercarse a Diego
  const enc = await rpc(b, 'mis_encuentros')
  for (const e of enc) {
    if (e.estado === 'pendiente' && !e.soy_solicitante && b.responde) {
      await rpc(b, 'responder_encuentro', { p_id: e.id, p_acepta: true })
      console.log(`${b.nombre}: aceptó el encuentro`)
    }
    if (e.estado === 'activo' || (e.estado === 'pendiente' && !e.soy_solicitante)) {
      const mia = posiciones[b.k] ?? { lat: BASE.lat + b.dlat, lng: BASE.lng + b.dlng }
      const [s] = await rpc(b, 'encuentro_sync', { p_id: e.id, p_lat: mia.lat, p_lng: mia.lng })
      if (s?.estado === 'activo' && s.otro_lat != null && (s.distancia_m ?? 0) > 30) {
        const paso = Math.min(40, s.distancia_m - 20) // ~40 m cada 4 s = 10 m/s
        const f = paso / s.distancia_m
        posiciones[b.k] = { lat: mia.lat + (s.otro_lat - mia.lat) * f, lng: mia.lng + (s.otro_lng - mia.lng) * f }
      } else posiciones[b.k] = mia
      if (s?.llegaron && !b._avisoLlegada) { console.log(`${b.nombre}: llegaron (<= 50 m)`); b._avisoLlegada = true }
    } else if (e.estado !== 'activo') { delete posiciones[b.k]; b._avisoLlegada = false }
  }
  if (!enc.some((e) => e.estado === 'activo')) { delete posiciones[b.k]; b._avisoLlegada = false }
  // chat: contestar el ultimo mensaje de Diego
  if (b.responde) {
    for (const ch of await rpc(b, 'mis_chats')) {
      if (ch.otro_id !== diego || ch.ultimo_mio || ch.ultimo_kind !== 'texto') continue
      const clave = `${ch.id}|${ch.ultimo_at}`
      if (b._ultimo === clave) continue
      b._ultimo = clave
      const s = await ses(b)
      const texto = RESPUESTAS[Math.floor(Math.random() * RESPUESTAS.length)]
      await api(b, '/rest/v1/messages', { method: 'POST', body: { conversation_id: ch.id, sender_id: s.id, body: texto } })
      console.log(`${b.nombre}: respondió "${texto}"`)
    }
  }
}

// Mantiene frescas la ubicacion (vence a los 7 dias) y la disponibilidad (vence a las 8 horas) de los bots.
async function refrescarBots() {
  const disp = BOTS.filter((b) => b.disponible && b.ofrece).map((b) => q(b.email)).join(', ')
  await sql(`update profile_private set location_updated_at = now() where user_id in (select id from auth.users where email like 'bot-%@cercaya.test')`)
  if (disp) await sql(`update profile_private set disponible_hasta = now() + interval '8 hours' where user_id in (select id from auth.users where email in (${disp}))`)
}

async function correr() {
  const diego = await diegoId()
  await refrescarBots()
  console.log('Bots escuchando (Ctrl+C para cortar). Revisan cada 4 s.')
  let n = 0
  for (;;) {
    for (const b of BOTS) { try { await tick(b, diego) } catch (e) { console.error(`${b.k}: ${e.message}`) } }
    if (++n % 450 === 0) await refrescarBots()
    await new Promise((r) => setTimeout(r, 4000))
  }
}

// ---------------------------------------------------------------- comandos sueltos
async function estado() {
  const r = await sql(`
select u.email, p.full_name, pv.share_location comparte, pv.es_publico publico,
       coalesce((select c.status || case when c.requester_id = u.id then ' (pidió el bot)' else ' (pidió Diego)' end
                   from contacts c join auth.users d on d.email = ${q(DIEGO)}
                  where (c.requester_id = u.id and c.addressee_id = d.id) or (c.requester_id = d.id and c.addressee_id = u.id)), '-') as contacto_con_diego
  from auth.users u join profiles p on p.id = u.id join profile_private pv on pv.user_id = u.id
 where u.email like 'bot-%@cercaya.test' order by u.email`)
  console.table(r)
}
async function pedir(k) {
  const b = bot(k)
  const id = await rpc(b, 'pedir_encuentro', { p_destino: await diegoId(), p_minutos: 60 })
  console.log(`${b.nombre} te pidió un encuentro (${id}). Aceptalo en la app; con "correr" andando el bot se acerca.`)
}
async function msg(k, texto) {
  const b = bot(k), s = await ses(b)
  const cid = await rpc(b, 'abrir_chat', { p_other: await diegoId() })
  await api(b, '/rest/v1/messages', { method: 'POST', body: { conversation_id: cid, sender_id: s.id, body: texto } })
  console.log(`${b.nombre} te escribió: ${texto}`)
}
async function solicitar(k) {
  const b = bot(k)
  await rpc(b, 'solicitar_contacto', { p_destino: await diegoId() })
  console.log(`${b.nombre} te mandó solicitud de contacto.`)
}
async function buscarServicioComo(k, texto) {
  const b = bot(k)
  const r = await rpc(b, 'buscar_servicio', { p_texto: texto, p_radio_km: 50 })
  console.log(`${b.nombre} busca "${texto}": ${r.length} resultado(s)`)
  console.table(r.map((x) => ({ nombre: x.full_name, coincide: x.coincide, contacto: x.es_contacto, zona: x.zona, km: x.distancia_km })))
}
async function limpiar() {
  const r = await sql(`delete from auth.users where email like 'bot-%@cercaya.test' returning email`)
  console.log(`Borrados ${r.length} bots.`)
}

const [cmd, a, ...resto] = process.argv.slice(2)
const comandos = { sembrar, correr, estado, pedir: () => pedir(a), msg: () => msg(a, resto.join(' ')), solicitar: () => solicitar(a), buscar: () => buscarServicioComo(a, resto.join(' ')), limpiar }
if (!comandos[cmd]) { console.error('Uso: node scripts/bots.mjs <sembrar|correr|estado|pedir|msg|solicitar|limpiar>'); process.exit(1) }
await comandos[cmd]()
