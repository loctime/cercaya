import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { crearDb, RAMALLO } from './harness.mjs'

let db
before(async () => { db = await crearDb() })
after(async () => { await db.cerrar() })

const como = (userId, sql, params = []) => db.como(userId, (d) => d.sql(sql, params))
const rechaza = (promesa, patron) => assert.rejects(promesa, patron)
const CELDA = 0.003

let contador = 0
const nombre = (base) => `${base} ${++contador}`

// Dos usuarios que ya son contactos. `comparte` deja a b compartiendo ubicacion ahora.
async function parDeContactos({ comparte = true, ubicacionB = { lat: -33.484, lng: -60.017 } } = {}) {
  const a = await db.usuario(nombre('Ana'), RAMALLO)
  const b = await db.usuario(nombre('Beto'), ubicacionB)
  const [{ solicitar_contacto: solicitud }] = await como(a, 'select solicitar_contacto($1)', [b])
  await como(b, 'select responder_contacto($1, true)', [solicitud])
  if (comparte) {
    await db.sql('update profile_private set share_location = true, location_updated_at = now() where user_id = $1', [b])
  }
  return { a, b }
}

// ---------------------------------------------------------------- difuminar

test('difuminar: es determinista y queda a menos de media celda por eje', async () => {
  const u = await db.usuario(nombre('Difu'))
  const punto = (lat, lng) => db.uno('select * from difuminar($1, $2, $3, $4)', [lat, lng, u, CELDA])
  assert.deepEqual(await punto(RAMALLO.lat, RAMALLO.lng), await punto(RAMALLO.lat, RAMALLO.lng))
  for (let i = 0; i < 50; i++) {
    const lat = RAMALLO.lat + (Math.random() - 0.5) * 0.05
    const lng = RAMALLO.lng + (Math.random() - 0.5) * 0.05
    const r = await punto(lat, lng)
    assert.ok(Math.abs(r.lat - lat) <= CELDA / 2 + 1e-9, `lat ${lat}`)
    assert.ok(Math.abs(r.lng - lng) <= CELDA / 2 + 1e-9, `lng ${lng}`)
  }
})

test('difuminar: moverse dentro de la celda no cambia el punto (promediar no sirve)', async () => {
  const u = await db.usuario(nombre('Difu'))
  const vistos = new Set()
  for (let i = 0; i < 100; i++) {
    const r = await db.uno('select * from difuminar($1, $2, $3, $4)', [RAMALLO.lat + i * 0.00001, RAMALLO.lng, u, CELDA])
    vistos.add(r.lat)
  }
  // 100 pasos de 0,00001 grados cubren 0,001: un tercio de celda, cruza a lo sumo un borde.
  assert.ok(vistos.size <= 2, `puntos distintos: ${vistos.size}`)
})

test('difuminar: dos personas en el mismo lugar no siempre coinciden', async () => {
  const vistos = new Set()
  for (let i = 0; i < 20; i++) {
    const u = await db.usuario(nombre('Difu'))
    const r = await db.uno('select * from difuminar($1, $2, $3, $4)', [RAMALLO.lat, RAMALLO.lng, u, CELDA])
    vistos.add(`${r.lat},${r.lng}`)
  }
  assert.ok(vistos.size >= 2)
})

// ------------------------------------------------- compartir y privacidad

test('share_location arranca apagado y solo lo edita su duenio', async () => {
  const a = await db.usuario(nombre('Priv'), RAMALLO)
  const otro = await db.usuario(nombre('Priv'), RAMALLO)
  assert.equal((await db.uno('select share_location from profile_private where user_id = $1', [a])).share_location, false)
  const propio = await como(a, 'update profile_private set share_location = true where user_id = $1 returning 1', [a])
  assert.equal(propio.length, 1)
  const ajeno = await como(otro, 'update profile_private set share_location = false where user_id = $1 returning 1', [a])
  assert.equal(ajeno.length, 0, 'otro usuario no toca filas ajenas')
  assert.equal((await db.uno('select share_location from profile_private where user_id = $1', [a])).share_location, true)
})

test('profiles: nadie lee ubicacion derivada; invitados siguen leyendo nombre y foto', async () => {
  const a = await db.usuario(nombre('Priv'), RAMALLO)
  for (const quien of [null, a]) {
    await rechaza(como(quien, 'select approx_lat from profiles'), /permission denied/)
    await rechaza(como(quien, 'select approx_lng from profiles'), /permission denied/)
    await rechaza(como(quien, 'select zone_label from profiles'), /permission denied/)
  }
  const invitado = await como(null, 'select id, full_name, avatar_url from profiles where id = $1', [a])
  assert.equal(invitado.length, 1)
  await rechaza(como(null, 'select is_admin from profiles'), /permission denied/)
  assert.equal((await como(a, 'select is_admin from profiles where id = $1', [a])).length, 1)
})

// ---------------------------------------------------------------- contactos

test('contactos: solicitar y aceptar deja a los dos como contactos', async () => {
  const a = await db.usuario(nombre('Ana'))
  const b = await db.usuario(nombre('Beto'))
  const [{ solicitar_contacto: id }] = await como(a, 'select solicitar_contacto($1)', [b])
  assert.equal((await como(b, 'select * from mis_contactos()'))[0].estado, 'recibida')
  assert.equal((await como(a, 'select * from mis_contactos()'))[0].estado, 'enviada')
  await como(b, 'select responder_contacto($1, true)', [id])
  assert.equal((await como(a, 'select * from mis_contactos()'))[0].estado, 'aceptado')
  assert.equal((await como(b, 'select * from mis_contactos()'))[0].estado, 'aceptado')
  assert.equal((await como(a, 'select es_contacto($1, $2) ok', [a, b]))[0].ok, true)
  assert.equal((await como(b, 'select es_contacto($1, $2) ok', [a, b]))[0].ok, true)
})

test('contactos: rechazar borra la solicitud y se puede volver a pedir', async () => {
  const a = await db.usuario(nombre('Ana'))
  const b = await db.usuario(nombre('Beto'))
  const [{ solicitar_contacto: id }] = await como(a, 'select solicitar_contacto($1)', [b])
  await como(b, 'select responder_contacto($1, false)', [id])
  assert.equal((await como(a, 'select * from mis_contactos()')).length, 0)
  await como(a, 'select solicitar_contacto($1)', [b])
})

test('contactos: solicitudes cruzadas terminan en un solo contacto aceptado', async () => {
  const a = await db.usuario(nombre('Cruce'))
  const b = await db.usuario(nombre('Cruce'))
  await como(a, 'select solicitar_contacto($1)', [b])
  await como(b, 'select solicitar_contacto($1)', [a])
  const filas = await db.sql('select status from contacts where requester_id in ($1, $2) and addressee_id in ($1, $2)', [a, b])
  assert.deepEqual(filas.map((f) => f.status), ['aceptado'])
})

test('contactos: no a uno mismo, no duplicadas, solo el destinatario responde', async () => {
  const a = await db.usuario(nombre('Ana'))
  const b = await db.usuario(nombre('Beto'))
  await rechaza(como(a, 'select solicitar_contacto($1)', [a]), /vos mismo/)
  const [{ solicitar_contacto: id }] = await como(a, 'select solicitar_contacto($1)', [b])
  await rechaza(como(a, 'select solicitar_contacto($1)', [b]), /Ya son contactos o hay una solicitud/)
  await rechaza(como(a, 'select responder_contacto($1, true)', [id]), /No podes responder/)
  const tercero = await db.usuario(nombre('Tercero'))
  await rechaza(como(tercero, 'select responder_contacto($1, true)', [id]), /No podes responder/)
})

test('contactos: un bloqueo en cualquier direccion frena solicitudes y busqueda', async () => {
  const a = await db.usuario('Ana Buscadora Unica')
  const b = await db.usuario('Beto Bloqueado Unico')
  await como(a, 'insert into blocks (blocker_id, blocked_id) values ($1, $2)', [a, b])
  await rechaza(como(a, 'select solicitar_contacto($1)', [b]), /No se puede enviar la solicitud/)
  await rechaza(como(b, 'select solicitar_contacto($1)', [a]), /No se puede enviar la solicitud/)
  assert.equal((await como(a, "select * from buscar_usuarios('Bloqueado Unico')")).length, 0)
  assert.equal((await como(b, "select * from buscar_usuarios('Buscadora Unica')")).length, 0)
})

test('contactos: tope de 20 solicitudes por dia', async () => {
  const a = await db.usuario(nombre('Spam'))
  for (let i = 0; i < 20; i++) {
    const destino = await db.usuario(nombre('Destino'))
    await como(a, 'select solicitar_contacto($1)', [destino])
  }
  const otro = await db.usuario(nombre('Destino'))
  await rechaza(como(a, 'select solicitar_contacto($1)', [otro]), /Limite diario/)
})

test('contactos: buscar por nombre o por telefono, sin devolver el telefono', async () => {
  const a = await db.usuario(nombre('Ana'))
  const b = await db.usuario('Busco Por Telefono', { phone: '3407 123456' })
  const porNombre = await como(a, "select * from buscar_usuarios('Por Telef')")
  const porTelefono = await como(a, "select * from buscar_usuarios('03407123456')")
  assert.deepEqual(porNombre.map((r) => r.user_id), [b])
  assert.deepEqual(porTelefono.map((r) => r.user_id), [b])
  assert.deepEqual(Object.keys(porTelefono[0]), ['user_id', 'full_name', 'avatar_url', 'estado'])
  assert.equal((await como(a, "select * from buscar_usuarios('Bu')")).length, 0, 'menos de 3 letras no busca')
})

test('contactos: un invitado no puede usar ninguna funcion', async () => {
  const x = '00000000-0000-0000-0000-000000000000'
  for (const sql of [
    'select solicitar_contacto($1)', 'select quitar_contacto($1)', 'select * from mis_contactos()',
    'select * from buscar_usuarios($1)', 'select * from mapa_contactos()', 'select * from perfil_social($1)',
  ]) {
    await rechaza(como(null, sql, sql.includes('$1') ? [x] : []), /permission denied/, sql)
  }
  await rechaza(como(null, 'select * from contacts'), /permission denied/)
})

// ----------------------------------------------------------------- curriculum

test('curriculum: lo ve el duenio y sus contactos, no los demas', async () => {
  const { a, b } = await parDeContactos()
  const c = await db.usuario(nombre('Cora'))
  await como(b, "insert into cv_entries (user_id, titulo, desde_anio) values ($1, 'Plomero', 2020)", [b])
  await como(b, "insert into oficios (user_id, label) values ($1, 'Plomería')", [b])
  assert.equal((await como(b, 'select * from cv_entries where user_id = $1', [b])).length, 1)
  assert.equal((await como(a, 'select * from cv_entries where user_id = $1', [b])).length, 1)
  assert.equal((await como(a, 'select * from oficios where user_id = $1', [b])).length, 1)
  assert.equal((await como(c, 'select * from cv_entries where user_id = $1', [b])).length, 0)
  assert.equal((await como(c, 'select * from oficios where user_id = $1', [b])).length, 0)
})

test('curriculum: nadie escribe en el de otro', async () => {
  const { a, b } = await parDeContactos()
  await rechaza(
    como(a, "insert into cv_entries (user_id, titulo, desde_anio) values ($1, 'Falso', 2020)", [b]),
    /row-level security/,
  )
  await como(b, "insert into cv_entries (user_id, titulo, desde_anio) values ($1, 'Real', 2020)", [b])
  const borradas = await como(a, 'delete from cv_entries where user_id = $1 returning 1', [b])
  assert.equal(borradas.length, 0)
})

test('curriculum: validaciones y limites', async () => {
  const u = await db.usuario(nombre('Cv'))
  await rechaza(
    como(u, "insert into cv_entries (user_id, titulo, desde_anio, hasta_anio) values ($1, 'X', 2020, 2019)", [u]),
    /check constraint/,
  )
  for (let i = 0; i < 20; i++) {
    await como(u, 'insert into cv_entries (user_id, titulo, desde_anio) values ($1, $2, 2020)', [u, `Trabajo ${i}`])
  }
  await rechaza(
    como(u, "insert into cv_entries (user_id, titulo, desde_anio) values ($1, 'Uno mas', 2020)", [u]),
    /Hasta 20 experiencias/,
  )
  for (let i = 0; i < 15; i++) {
    await como(u, 'insert into oficios (user_id, label) values ($1, $2)', [u, `Oficio ${i}`])
  }
  await rechaza(como(u, "insert into oficios (user_id, label) values ($1, 'Otro oficio')", [u]), /Hasta 15 oficios/)
})

test('curriculum: un oficio puede venir de una categoria o ser propio', async () => {
  const u = await db.usuario(nombre('Oficio'))
  await como(u, "insert into oficios (user_id, label, category_id) values ($1, 'Plomería', 4)", [u])
  await como(u, "insert into oficios (user_id, label) values ($1, 'Cambio de bombillas')", [u])
  const filas = await como(u, 'select label, category_id from oficios where user_id = $1 order by label', [u])
  assert.deepEqual(filas.map((f) => f.category_id), [null, 4])
})

// ---------------------------------------------------------------------- mapa

test('mapa: un contacto que comparte aparece difuminado, sin datos exactos', async () => {
  const { a } = await parDeContactos({ ubicacionB: { lat: -33.484, lng: -60.017 } })
  const mapa = await como(a, 'select * from mapa_contactos()')
  assert.equal(mapa.length, 1)
  assert.deepEqual(Object.keys(mapa[0]), ['user_id', 'full_name', 'avatar_url', 'lat', 'lng', 'actualizada_at', 'desactualizada'])
  assert.notEqual(mapa[0].lat, -33.484)
  assert.ok(Math.abs(mapa[0].lat - -33.484) <= CELDA / 2 + 1e-9)
  assert.ok(Math.abs(mapa[0].lng - -60.017) <= CELDA / 2 + 1e-9)
  assert.equal(mapa[0].desactualizada, false)
})

test('mapa: no aparece quien no comparte (el caso por defecto)', async () => {
  const { a } = await parDeContactos({ comparte: false })
  assert.equal((await como(a, 'select * from mapa_contactos()')).length, 0)
})

test('mapa: no aparecen solicitudes pendientes, desconocidos ni uno mismo', async () => {
  const a = await db.usuario(nombre('Ana'), RAMALLO)
  const pendiente = await db.usuario(nombre('Pendiente'), RAMALLO)
  const desconocido = await db.usuario(nombre('Desconocido'), RAMALLO)
  await como(a, 'select solicitar_contacto($1)', [pendiente])
  await db.sql('update profile_private set share_location = true, location_updated_at = now() where user_id = any($1)', [[a, pendiente, desconocido]])
  assert.equal((await como(a, 'select * from mapa_contactos()')).length, 0)
})

test('mapa: un bloqueo lo esconde', async () => {
  const { a, b } = await parDeContactos()
  await como(b, 'insert into blocks (blocker_id, blocked_id) values ($1, $2)', [b, a])
  assert.equal((await como(a, 'select * from mapa_contactos()')).length, 0)
})

test('mapa: marca desactualizada pasados 30 minutos y desaparece pasadas 24 horas', async () => {
  const { a, b } = await parDeContactos()
  const fijar = (intervalo) => db.sql(`update profile_private set location_updated_at = now() - interval '${intervalo}' where user_id = $1`, [b])
  await fijar('29 minutes')
  assert.equal((await como(a, 'select * from mapa_contactos()'))[0].desactualizada, false)
  await fijar('31 minutes')
  assert.equal((await como(a, 'select * from mapa_contactos()'))[0].desactualizada, true)
  await fijar('23 hours')
  assert.equal((await como(a, 'select * from mapa_contactos()'))[0].desactualizada, true)
  await fijar('25 hours')
  assert.equal((await como(a, 'select * from mapa_contactos()')).length, 0)
})

test('perfil_social: la zona solo se ve si el contacto esta compartiendo', async () => {
  const { a, b } = await parDeContactos()
  const c = await db.usuario(nombre('Cora'), RAMALLO)
  assert.ok((await como(a, 'select * from perfil_social($1)', [b]))[0].zone_label, 'contacto que comparte')
  assert.equal((await como(a, 'select * from perfil_social($1)', [b]))[0].estado, 'aceptado')
  await db.sql('update profile_private set share_location = false where user_id = $1', [b])
  assert.equal((await como(a, 'select * from perfil_social($1)', [b]))[0].zone_label, null, 'contacto que apago')
  const extrano = (await como(c, 'select * from perfil_social($1)', [b]))[0]
  assert.equal(extrano.zone_label, null, 'no contacto')
  assert.equal(extrano.estado, null)
  assert.ok((await como(b, 'select * from perfil_social($1)', [b]))[0].zone_label, 'uno mismo')
})
