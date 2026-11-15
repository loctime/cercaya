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

// Quien busca: con ubicacion guardada y fresca.
async function buscador(pos = RAMALLO) {
  const id = await db.usuario(nombre('Busca'), pos)
  await db.sql('update profile_private set location_updated_at = now() where user_id = $1', [id])
  return id
}

async function admin() {
  const id = await db.usuario(nombre('Admin'))
  await db.sql('update profiles set is_admin = true where id = $1', [id])
  return id
}

let igN = 0
// Carga un negocio como superusuario (el script de carga corre asi).
async function cargar(datos = {}) {
  const d = {
    nombre: nombre('Negocio'),
    catalogo: 'plomero',
    instagram: `negocio.${++igN}`,
    tipo: 'local',
    ...RAMALLO,
    telefono: null,
    bio: null,
    ...datos,
  }
  const r = await db.uno(
    'select cargar_negocio($1, $2, $3, $4, $5, $6, $7, $8) id',
    [d.nombre, d.catalogo, d.instagram, d.tipo, d.lat, d.lng, d.telefono, d.bio],
  )
  return r.id
}

const cerca = (yo, texto, radio = 15) => como(yo, 'select * from negocios_cerca($1, $2)', [texto, radio])

// ---------------------------------------------------------------- carga

test('cargar_negocio: normaliza el usuario de Instagram y no admite duplicados', async () => {
  const id = await cargar({ instagram: '@Panaderia.Lopez', catalogo: 'plomero' })
  const fila = await db.uno('select instagram_usuario, estado from negocios where id = $1', [id])
  assert.equal(fila.instagram_usuario, 'panaderia.lopez')
  assert.equal(fila.estado, 'sin_reclamar')
  await rechaza(cargar({ instagram: 'panaderia.lopez' }), /Ya existe un negocio con ese Instagram/)
  await rechaza(cargar({ instagram: '@PANADERIA.LOPEZ' }), /Ya existe un negocio con ese Instagram/)
})

test('cargar_negocio: un usuario comun no puede cargar, un admin si', async () => {
  const comun = await buscador()
  await rechaza(
    como(comun, `select cargar_negocio('X Negocio', 'plomero', 'intento.comun', 'local', -33.48, -60.01, null, null)`),
    /administrador|permission denied/i,
  )
  const adm = await admin()
  const r = await como(adm, `select cargar_negocio('Del Admin', 'plomero', 'del.admin', 'local', -33.48, -60.01, null, null) id`)
  assert.ok(r[0].id)
})

// ---------------------------------------------------------------- negocios_cerca

test('negocios_cerca: local muestra telefono y coordenadas reales', async () => {
  const yo = await buscador()
  const id = await cargar({ nombre: 'Plomeria El Local', tipo: 'local', ...CERCA, telefono: '3407555555' })
  const r = (await cerca(yo, 'plomero')).find((x) => x.id === id)
  assert.ok(r, 'tiene que aparecer')
  assert.equal(r.telefono, '3407555555')
  assert.equal(Number(r.lat), CERCA.lat)
  assert.equal(Number(r.lng), CERCA.lng)
  assert.equal(r.rubro, 'Plomero')
  assert.equal(r.estado, 'sin_reclamar')
  assert.equal(r.es_mio, false)
})

test('negocios_cerca: a_domicilio no expone telefono ni coordenadas exactas', async () => {
  const yo = await buscador()
  const id = await cargar({ nombre: 'Plomero Casero', tipo: 'a_domicilio', ...CERCA, telefono: '3407666666' })
  const r = (await cerca(yo, 'plomero')).find((x) => x.id === id)
  assert.ok(r, 'tiene que aparecer')
  assert.equal(r.telefono, null)
  assert.notEqual(Number(r.lat), CERCA.lat)
  assert.notEqual(Number(r.lng), CERCA.lng)
  assert.ok(Math.abs(Number(r.lat) - CERCA.lat) < 0.03 && Math.abs(Number(r.lng) - CERCA.lng) < 0.03, 'queda cerca')
})

test('negocios_cerca: encuentra por sinonimo del rubro y por nombre', async () => {
  const yo = await buscador()
  const id = await cargar({ nombre: 'Plomeria Don Raul', catalogo: 'plomero', ...CERCA })
  for (const texto of ['plomeria', 'don raul', 'Don Raúl']) {
    assert.ok((await cerca(yo, texto)).some((x) => x.id === id), `"${texto}" tiene que encontrarlo`)
  }
  const canilla = await cargar({ nombre: 'Sanitarios Sur', catalogo: 'arreglar-canilla', ...CERCA })
  assert.ok((await cerca(yo, 'canilla pierde')).some((x) => x.id === canilla))
})

test('negocios_cerca: texto vacio, relleno o de una letra no devuelve nada', async () => {
  const yo = await buscador()
  await cargar({ ...CERCA })
  for (const texto of ['', '   ', 'de una', 'a', '¿?']) {
    assert.equal((await cerca(yo, texto)).length, 0, `"${texto}"`)
  }
})

test('negocios_cerca: respeta el radio y no muestra ocultos', async () => {
  const yo = await buscador()
  const lejos = await cargar({ nombre: 'Plomeria Lejana', ...ROSARIO })
  const oculto = await cargar({ nombre: 'Plomeria Oculta', ...CERCA })
  await db.sql(`update negocios set estado = 'oculto', motivo_oculto = 'admin' where id = $1`, [oculto])
  const r = await cerca(yo, 'plomeria')
  assert.ok(!r.some((x) => x.id === lejos), 'fuera del radio')
  assert.ok(!r.some((x) => x.id === oculto), 'oculto')
  const amplio = await cerca(yo, 'plomeria', 500)
  assert.ok(!amplio.some((x) => x.id === lejos), 'el radio maximo es 50 km')
  const villa = await cargar({ nombre: 'Plomeria Villa', ...VILLA })
  assert.ok((await cerca(yo, 'plomeria', 15)).some((x) => x.id === villa))
})

test('negocios_cerca: invitados y tablas cerradas', async () => {
  const yo = await buscador()
  await rechaza(como(null, `select * from negocios_cerca('plomero', 15)`), /permission denied/)
  await rechaza(como(yo, 'select * from negocios'), /permission denied/)
  await rechaza(como(null, `select cargar_negocio('X Negocio', 'plomero', 'anon.intento', 'local', -33.48, -60.01, null, null)`), /permission denied/)
})
