import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { crearDb, RAMALLO, CERCA, VILLA, ROSARIO } from './harness.mjs'

let db
before(async () => { db = await crearDb() })
after(async () => { await db.cerrar() })

const como = (userId, sql, params = []) => db.como(userId, (d) => d.sql(sql, params))
const rechaza = (promesa, patron) => assert.rejects(promesa, patron)

let contador = 0
const nombre = (base) => `${base} ${++contador}`

const CANILLA = ['Arreglar una canilla', 'arreglar-canilla']
const LAMPARITA = ['Cambiar una lamparita', 'cambiar-lamparita']

// Quien busca: con ubicacion guardada y fresca.
async function buscador(pos = RAMALLO) {
  const id = await db.usuario(nombre('Busca'), pos)
  await db.sql('update profile_private set location_updated_at = now() where user_id = $1', [id])
  return id
}

// Alguien que ofrece servicios: primero las habilidades, despues el interruptor.
async function ofrece(base, pos, habilidades = [CANILLA], { activo = true } = {}) {
  const id = await db.usuario(nombre(base), pos)
  for (const [label, catalogo] of habilidades) {
    await db.sql(`insert into oficios (user_id, label, catalog_id, tipo) values ($1, $2, $3, 'tarea')`, [id, label, catalogo])
  }
  await db.sql('update profile_private set location_updated_at = now() where user_id = $1', [id])
  if (activo) await db.sql('update profile_private set ofrece_servicios = true where user_id = $1', [id])
  return id
}

const buscar = (yo, texto, radio = 15) => como(yo, 'select * from buscar_servicio($1, $2)', [texto, radio])

// ---------------------------------------------------------------- buscar_servicio

test('buscar_servicio: encuentra por sinonimo, sin tildes ni mayusculas', async () => {
  const yo = await buscador()
  const pro = await ofrece('Plomero', CERCA)
  for (const texto of ['Canilla rota', 'Reparación canilla', 'ARREGLAR CANILLA', 'canilla pierde']) {
    const r = await buscar(yo, texto)
    assert.ok(r.some((x) => x.user_id === pro), `"${texto}" tiene que encontrarlo`)
    assert.equal(r.find((x) => x.user_id === pro).coincide, 'Arreglar una canilla')
  }
})

test('buscar_servicio: no muestra a quien no activo, aunque sea publico y tenga oficios', async () => {
  const yo = await buscador()
  const inactivo = await ofrece('Inactivo', CERCA, [CANILLA], { activo: false })
  await db.sql('update profile_private set es_publico = true where user_id = $1', [inactivo])
  const r = await buscar(yo, 'canilla')
  assert.ok(!r.some((x) => x.user_id === inactivo))
})

test('buscar_servicio: incluye contactos que ofrecen y los marca', async () => {
  const yo = await buscador()
  const amigo = await ofrece('Amigo', CERCA)
  const desconocido = await ofrece('Desconocido', VILLA)
  const [{ solicitar_contacto: s }] = await como(yo, 'select solicitar_contacto($1)', [amigo])
  await como(amigo, 'select responder_contacto($1, true)', [s])
  const r = await buscar(yo, 'canilla')
  assert.equal(r.find((x) => x.user_id === amigo).es_contacto, true)
  assert.equal(r.find((x) => x.user_id === desconocido).es_contacto, false)
})

test('buscar_servicio: nunca devuelve la ubicacion exacta', async () => {
  const yo = await buscador()
  const pro = await ofrece('Exacto', CERCA)
  const fila = (await buscar(yo, 'canilla')).find((x) => x.user_id === pro)
  assert.ok(fila.lat !== CERCA.lat || fila.lng !== CERCA.lng, 'no puede ser el punto real')
  assert.ok(Math.abs(fila.lat - CERCA.lat) <= 0.03 && Math.abs(fila.lng - CERCA.lng) <= 0.03)
})

test('buscar_servicio: respeta bloqueos, radio, frescura y no se devuelve a uno mismo', async () => {
  const yo = await buscador()
  const bloqueado = await ofrece('Bloqueado', CERCA)
  await como(bloqueado, 'insert into blocks (blocker_id, blocked_id) values ($1, $2)', [bloqueado, yo])
  const lejos = await ofrece('Lejos', ROSARIO)
  const viejo = await ofrece('Viejo', CERCA)
  await db.sql(`update profile_private set location_updated_at = now() - interval '8 days' where user_id = $1`, [viejo])
  const yoMismo = await ofrece('Yo mismo', RAMALLO)

  const r = await buscar(yo, 'canilla', 50)
  assert.ok(!r.some((x) => x.user_id === bloqueado), 'bloqueado en cualquier sentido')
  assert.ok(!r.some((x) => x.user_id === lejos), '80 km queda fuera aun con 50 km')
  assert.ok(!r.some((x) => x.user_id === viejo), 'ubicacion de hace 8 dias')
  const propio = await buscar(yoMismo, 'canilla')
  assert.ok(!propio.some((x) => x.user_id === yoMismo))
})

test('buscar_servicio: el radio por defecto corta lo lejano y 50 km lo trae', async () => {
  const yo = await buscador()
  const medio = await ofrece('Medio', { lat: -33.8, lng: -60.0167 }) // ~35 km
  assert.ok(!(await buscar(yo, 'canilla', 15)).some((x) => x.user_id === medio))
  assert.ok((await buscar(yo, 'canilla', 50)).some((x) => x.user_id === medio))
})

test('buscar_servicio: texto que normaliza a vacio no devuelve nada ni falla', async () => {
  const yo = await buscador()
  await ofrece('Activo', CERCA)
  for (const texto of ['   ', '¿?', '%', '_', '', 'a']) {
    assert.deepEqual(await buscar(yo, texto), [], `"${texto}" no debe devolver gente`)
  }
})

test('buscar_servicio: sin ubicacion propia devuelve vacio sin error', async () => {
  const sinUbicacion = await db.usuario(nombre('Sin ubicacion'))
  await ofrece('Activo', CERCA)
  assert.deepEqual(await buscar(sinUbicacion, 'canilla'), [])
})

// ---------------------------------------------------------------- ofrece_servicios

test('ofrece_servicios: no se puede activar sin habilidades', async () => {
  const sin = await db.usuario(nombre('Sin habilidades'), RAMALLO)
  await rechaza(
    como(sin, 'update profile_private set ofrece_servicios = true where user_id = $1', [sin]),
    /habilidad/i,
  )
})

test('ofrece_servicios: se apaga solo al borrar la ultima habilidad', async () => {
  const yo = await buscador()
  const pro = await ofrece('Dos habilidades', CERCA, [CANILLA, LAMPARITA])
  await db.sql('delete from oficios where user_id = $1 and catalog_id = $2', [pro, 'cambiar-lamparita'])
  assert.equal((await db.uno('select ofrece_servicios from profile_private where user_id = $1', [pro])).ofrece_servicios, true)
  await db.sql('delete from oficios where user_id = $1 and catalog_id = $2', [pro, 'arreglar-canilla'])
  assert.equal((await db.uno('select ofrece_servicios from profile_private where user_id = $1', [pro])).ofrece_servicios, false)
  assert.ok(!(await buscar(yo, 'canilla')).some((x) => x.user_id === pro))
})

test('ofrece_servicios: apagarlo lo saca de la busqueda de inmediato', async () => {
  const yo = await buscador()
  const pro = await ofrece('Apagable', CERCA)
  assert.ok((await buscar(yo, 'canilla')).some((x) => x.user_id === pro))
  await como(pro, 'update profile_private set ofrece_servicios = false where user_id = $1', [pro])
  assert.ok(!(await buscar(yo, 'canilla')).some((x) => x.user_id === pro))
})

test('ofrece_servicios: solo el dueño lo edita', async () => {
  const dueno = await ofrece('Dueno', CERCA, [CANILLA], { activo: false })
  const otro = await db.usuario(nombre('Otro'), RAMALLO)
  const r = await como(otro, 'update profile_private set ofrece_servicios = true where user_id = $1 returning 1', [dueno])
  assert.equal(r.length, 0)
})

// ---------------------------------------------------------------- tope de chats

test('abrir_chat: tope de 10 chats nuevos por dia con no contactos', async () => {
  const yo = await db.usuario(nombre('Charlador'), RAMALLO)
  for (let i = 0; i < 10; i++) {
    const otro = await db.usuario(nombre('Desconocido'), RAMALLO)
    await como(yo, 'select abrir_chat($1)', [otro])
  }
  const undecimo = await db.usuario(nombre('Desconocido'), RAMALLO)
  await rechaza(como(yo, 'select abrir_chat($1)', [undecimo]), /limite de chats/i)
})

test('abrir_chat: el tope no cuenta reabrir una conversacion ni a los contactos', async () => {
  const yo = await db.usuario(nombre('Charlador'), RAMALLO)
  const primeros = []
  for (let i = 0; i < 10; i++) {
    const otro = await db.usuario(nombre('Desconocido'), RAMALLO)
    primeros.push(otro)
    await como(yo, 'select abrir_chat($1)', [otro])
  }
  await como(yo, 'select abrir_chat($1)', [primeros[0]]) // reabrir: no falla
  const amigo = await db.usuario(nombre('Amigo'), RAMALLO)
  const [{ solicitar_contacto: s }] = await como(yo, 'select solicitar_contacto($1)', [amigo])
  await como(amigo, 'select responder_contacto($1, true)', [s])
  await como(yo, 'select abrir_chat($1)', [amigo]) // contacto: no falla
})

// ---------------------------------------------------------------- buscar_habilidades_cerca (0110)

test('buscar_habilidades_cerca: las palabras no tienen que estar juntas en el catalogo', async () => {
  const yo = await buscador()
  const pro = await ofrece('Publico', CERCA)
  await db.sql('update profile_private set es_publico = true where user_id = $1', [pro])
  const r = await como(yo, 'select * from buscar_habilidades_cerca($1, 15)', ['ARREGLAR CANILLA'])
  assert.ok(r.some((x) => x.user_id === pro))
  assert.deepEqual(await como(yo, 'select * from buscar_habilidades_cerca($1, 15)', ['¿?']), [])
})

// ---------------------------------------------------------------- frases de la gente (revision final)

test('buscar_servicio: "canilla rota" encuentra a un Plomero del catalogo', async () => {
  const yo = await buscador()
  const plomero = await ofrece('Plomero catalogo', CERCA, [['Plomero', 'plomero']])
  for (const texto of ['Canilla rota', 'Reparación canilla', 'arreglar canilla']) {
    assert.ok((await buscar(yo, texto)).some((x) => x.user_id === plomero), `"${texto}"`)
  }
})

test('buscar_servicio: una habilidad escrita a mano se encuentra por frases', async () => {
  const yo = await buscador()
  const manual = await ofrece('Manual', CERCA, [['Arreglo canillas', null]])
  for (const texto of ['Canilla rota', 'Arreglar canilla', 'Reparación canilla', 'canillas']) {
    assert.ok((await buscar(yo, texto)).some((x) => x.user_id === manual), `"${texto}"`)
  }
})

test('buscar_servicio: palabras de relleno solas no devuelven a todos', async () => {
  const yo = await buscador()
  await ofrece('Activo', CERCA)
  for (const texto of ['arreglar', 'de la', 'rota', 'reparación', 'una']) {
    assert.deepEqual(await buscar(yo, texto), [], `"${texto}"`)
  }
})
