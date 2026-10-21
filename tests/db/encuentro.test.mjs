import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { crearDb, RAMALLO } from './harness.mjs'

let db
before(async () => { db = await crearDb() })
after(async () => { await db.cerrar() })

const como = (userId, sql, params = []) => db.como(userId, (d) => d.sql(sql, params))
const rechaza = (promesa, patron) => assert.rejects(promesa, patron)

let contador = 0
const nombre = (base) => `${base} ${++contador}`

// 0,00044 grados de latitud ~ 49 m; 0,00046 ~ 51 m.
const A_POS = { lat: RAMALLO.lat, lng: RAMALLO.lng }
const a49 = { lat: RAMALLO.lat + 0.00044, lng: RAMALLO.lng }
const a51 = { lat: RAMALLO.lat + 0.00046, lng: RAMALLO.lng }

async function contactos() {
  const a = await db.usuario(nombre('Ana'))
  const b = await db.usuario(nombre('Beto'))
  const [{ solicitar_contacto: s }] = await como(a, 'select solicitar_contacto($1)', [b])
  await como(b, 'select responder_contacto($1, true)', [s])
  return { a, b }
}
async function pedido(minutos = 120) {
  const { a, b } = await contactos()
  const [{ pedir_encuentro: id }] = await como(a, 'select pedir_encuentro($1, $2)', [b, minutos])
  return { a, b, id }
}
async function activo() {
  const { a, b, id } = await pedido()
  await como(b, 'select responder_encuentro($1, true)', [id])
  return { a, b, id }
}
const sync = (u, id, pos) => como(u, 'select * from encuentro_sync($1, $2, $3)', [id, pos.lat, pos.lng]).then((r) => r[0])
const posiciones = (id) => db.sql('select * from encounter_positions where encounter_id = $1', [id])

// ------------------------------------------------------------------- pedir

test('pedir: solo a contactos', async () => {
  const a = await db.usuario(nombre('Ana'))
  const extrano = await db.usuario(nombre('Extrano'))
  await rechaza(como(a, 'select pedir_encuentro($1)', [extrano]), /Solo podes pedirle a un contacto/)
})

test('pedir: un bloqueo lo frena en cualquier direccion', async () => {
  const { a, b } = await contactos()
  await como(b, 'insert into blocks (blocker_id, blocked_id) values ($1, $2)', [b, a])
  await rechaza(como(a, 'select pedir_encuentro($1)', [b]), /No se puede pedir el encuentro/)
  await rechaza(como(b, 'select pedir_encuentro($1)', [a]), /No se puede pedir el encuentro/)
})

test('pedir: no abre un segundo encuentro entre los mismos dos, en ningun sentido', async () => {
  const { a, b } = await pedido()
  await rechaza(como(a, 'select pedir_encuentro($1)', [b]), /Ya hay un encuentro abierto/)
  await rechaza(como(b, 'select pedir_encuentro($1)', [a]), /Ya hay un encuentro abierto/)
})

test('pedir: tope de 10 por dia', async () => {
  const a = await db.usuario(nombre('Insistente'))
  for (let i = 0; i < 11; i++) {
    const b = await db.usuario(nombre('Destino'))
    const [{ solicitar_contacto: s }] = await como(a, 'select solicitar_contacto($1)', [b])
    await como(b, 'select responder_contacto($1, true)', [s])
    if (i < 10) await como(a, 'select pedir_encuentro($1)', [b])
    else await rechaza(como(a, 'select pedir_encuentro($1)', [b]), /Limite diario/)
  }
})

test('pedir: solo 60 o 120 minutos', async () => {
  const { a, b } = await contactos()
  await rechaza(como(a, 'select pedir_encuentro($1, 45)', [b]), /60 o 120/)
})

test('pedir: le avisa al otro con una notificacion de tipo encuentro', async () => {
  const { b, id } = await pedido()
  const avisos = await db.sql("select title, data from notifications where user_id = $1 and kind = 'encuentro'", [b])
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].data.encounter_id, id)
  assert.match(avisos[0].title, /va para allá/)
})

// ---------------------------------------------------------------- responder

test('responder: solo el destinatario', async () => {
  const { a, id } = await pedido()
  const tercero = await db.usuario(nombre('Tercero'))
  await rechaza(como(a, 'select responder_encuentro($1, true)', [id]), /No podes responder/)
  await rechaza(como(tercero, 'select responder_encuentro($1, true)', [id]), /No podes responder/)
})

test('responder: rechazar cierra el encuentro y se puede volver a pedir', async () => {
  const { a, b, id } = await pedido()
  await como(b, 'select responder_encuentro($1, false)', [id])
  assert.equal((await db.uno('select status from encounters where id = $1', [id])).status, 'rechazado')
  await como(a, 'select pedir_encuentro($1)', [b])
})

test('responder: al aceptar queda activo por 120 minutos y avisa al solicitante', async () => {
  const { a, b, id } = await pedido()
  await como(b, 'select responder_encuentro($1, true)', [id])
  const e = await db.uno("select status, (ends_at - accepted_at) = interval '120 minutes' as dura from encounters where id = $1", [id])
  assert.equal(e.status, 'activo')
  assert.equal(e.dura, true)
  const avisos = await db.sql("select title from notifications where user_id = $1 and kind = 'encuentro'", [a])
  assert.equal(avisos.length, 1)
  assert.match(avisos[0].title, /aceptó/)
})

// --------------------------------------------------------------------- sync

test('pendiente: sync no entrega ni guarda posiciones', async () => {
  const { a, id } = await pedido()
  const r = await sync(a, id, A_POS)
  assert.equal(r.estado, 'pendiente')
  assert.equal(r.otro_lat, null)
  assert.equal((await posiciones(id)).length, 0)
})

test('activo: cada uno recibe la posicion exacta del otro, sin difuminar', async () => {
  const { a, b, id } = await activo()
  const primero = await sync(a, id, A_POS)
  assert.equal(primero.estado, 'activo')
  assert.equal(primero.otro_lat, null, 'el otro todavia no mando la suya')
  const deB = await sync(b, id, a49)
  assert.equal(deB.otro_lat, A_POS.lat)
  assert.equal(deB.otro_lng, A_POS.lng)
  const deA = await sync(a, id, A_POS)
  assert.equal(deA.otro_lat, a49.lat)
  assert.equal(deA.otro_lng, a49.lng)
  assert.ok(deA.distancia_m > 48 && deA.distancia_m < 50, `distancia ${deA.distancia_m}`)
})

test('sync: mandar de nuevo reemplaza mi posicion', async () => {
  const { a, id } = await activo()
  await sync(a, id, A_POS)
  await sync(a, id, a51)
  const filas = await posiciones(id)
  assert.equal(filas.length, 1)
  assert.equal(filas[0].lat, a51.lat)
})

test('tercero: no hace sync ni lee las tablas', async () => {
  const { id } = await activo()
  const tercero = await db.usuario(nombre('Tercero'))
  await rechaza(sync(tercero, id, A_POS), /No sos parte de este encuentro/)
  await rechaza(como(tercero, 'select * from encounters'), /permission denied/)
  await rechaza(como(tercero, 'select * from encounter_positions'), /permission denied/)
})

test('sync: una posicion fuera de rango se rechaza', async () => {
  const { a, id } = await activo()
  await rechaza(sync(a, id, { lat: 91, lng: 0 }), /Posicion invalida/)
})

// ----------------------------------------------------------------- terminar

test('terminar: cualquiera lo corta, se borran las posiciones y el sync lo refleja', async () => {
  const { a, b, id } = await activo()
  await sync(a, id, A_POS)
  await sync(b, id, a49)
  assert.equal((await posiciones(id)).length, 2)
  await como(b, 'select terminar_encuentro($1)', [id])
  assert.equal((await posiciones(id)).length, 0)
  const r = await sync(a, id, A_POS)
  assert.equal(r.estado, 'terminado')
  assert.equal(r.otro_lat, null)
  assert.equal((await posiciones(id)).length, 0, 'un sync despues de terminar no vuelve a guardar')
})

test('terminar: un tercero no puede', async () => {
  const { id } = await activo()
  const tercero = await db.usuario(nombre('Tercero'))
  await rechaza(como(tercero, 'select terminar_encuentro($1)', [id]), /No podes terminar/)
})

test('vence: pasada la hora el sync lo termina y borra las posiciones', async () => {
  const { a, b, id } = await activo()
  await sync(a, id, A_POS)
  await sync(b, id, a49)
  await db.sql("update encounters set ends_at = now() - interval '1 minute' where id = $1", [id])
  const r = await sync(a, id, A_POS)
  assert.equal(r.estado, 'terminado')
  assert.equal(r.otro_lat, null)
  assert.equal((await posiciones(id)).length, 0)
})

test('vence: una solicitud sin respuesta caduca a los 15 minutos', async () => {
  const { a, b, id } = await pedido()
  await db.sql("update encounters set created_at = now() - interval '16 minutes' where id = $1", [id])
  assert.equal((await como(b, 'select * from mis_encuentros()')).length, 0)
  assert.equal((await sync(a, id, A_POS)).estado, 'vencido')
  await rechaza(como(b, 'select responder_encuentro($1, true)', [id]), /No podes responder/)
})

test('un bloqueo en pleno encuentro lo termina en el siguiente sync', async () => {
  const { a, b, id } = await activo()
  await sync(a, id, A_POS)
  await sync(b, id, a49)
  await como(b, 'insert into blocks (blocker_id, blocked_id) values ($1, $2)', [b, a])
  const r = await sync(a, id, A_POS)
  assert.equal(r.estado, 'terminado')
  assert.equal(r.otro_lat, null)
  assert.equal((await posiciones(id)).length, 0)
})

test('quitar al contacto en pleno encuentro lo termina en el siguiente sync', async () => {
  const { a, b, id } = await activo()
  await sync(b, id, a49)
  await como(a, 'select quitar_contacto($1)', [b])
  const r = await sync(b, id, a49)
  assert.equal(r.estado, 'terminado')
  assert.equal((await posiciones(id)).length, 0)
})

// ------------------------------------------------------------------ llegada

test('llegaron: a 49 m si, a 51 m no', async () => {
  const { a, b, id } = await activo()
  await sync(a, id, A_POS)
  assert.equal((await sync(b, id, a49)).llegaron, true)
  assert.equal((await sync(b, id, a51)).llegaron, false)
})

test('llegaron: con la posicion del otro de hace 3 minutos no, aunque esten a 10 m', async () => {
  const { a, b, id } = await activo()
  await sync(a, id, A_POS)
  await sync(b, id, { lat: A_POS.lat + 0.00009, lng: A_POS.lng })
  await db.sql("update encounter_positions set updated_at = now() - interval '3 minutes' where encounter_id = $1 and user_id = $2", [id, a])
  const r = await sync(b, id, { lat: A_POS.lat + 0.00009, lng: A_POS.lng })
  assert.ok(r.distancia_m < 12)
  assert.equal(r.llegaron, false)
})

// ---------------------------------------------------------- mis encuentros

test('mis_encuentros: muestra la solicitud recibida y no los terminados', async () => {
  const { a, b, id } = await pedido()
  const deB = await como(b, 'select * from mis_encuentros()')
  assert.equal(deB.length, 1)
  assert.equal(deB[0].estado, 'pendiente')
  assert.equal(deB[0].soy_solicitante, false)
  assert.equal(deB[0].otro_id, a)
  assert.match(deB[0].otro_nombre, /Ana/)
  const deA = await como(a, 'select * from mis_encuentros()')
  assert.equal(deA[0].soy_solicitante, true)
  await como(a, 'select terminar_encuentro($1)', [id])
  assert.equal((await como(b, 'select * from mis_encuentros()')).length, 0)
})

// ------------------------------------------------------------------ invitado

test('invitado: ninguna funcion ni tabla', async () => {
  const x = '00000000-0000-0000-0000-000000000000'
  for (const sql of [
    'select pedir_encuentro($1)', 'select responder_encuentro($1, true)', 'select terminar_encuentro($1)',
    'select * from mis_encuentros()', 'select * from encuentro_sync($1, 0, 0)',
  ]) {
    await rechaza(como(null, sql, sql.includes('$1') ? [x] : []), /permission denied/, sql)
  }
  await rechaza(como(null, 'select * from encounters'), /permission denied/)
  await rechaza(como(null, 'select * from encounter_positions'), /permission denied/)
})
