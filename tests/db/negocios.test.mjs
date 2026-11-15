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

// ---------------------------------------------------------------- reclamos

const MAIL = 'dueno@correo.com'
const reclamar = (userId, negocio, mail = MAIL) =>
  como(userId, 'select reclamar_negocio($1, $2) codigo', [negocio, mail]).then((r) => r[0].codigo)

test('reclamar_negocio: devuelve un codigo de 6 caracteres y es idempotente', async () => {
  const yo = await buscador()
  const n = await cargar({ ...CERCA })
  const a = await reclamar(yo, n)
  assert.match(a, /^[0-9A-F]{6}$/)
  assert.equal(await reclamar(yo, n), a)
  const [{ total }] = await db.sql(`select count(*)::int total from negocio_reclamos where negocio_id = $1`, [n])
  assert.equal(total, 1)
  const mi = await como(yo, 'select * from mi_reclamo($1)', [n])
  assert.equal(mi[0].codigo, a)
})

test('reclamar_negocio: mail invalido y negocio oculto o ya reclamado rechazan', async () => {
  const yo = await buscador()
  const n = await cargar({ ...CERCA })
  await rechaza(reclamar(yo, n, 'no-es-un-mail'), /Revisá el mail/)
  const oculto = await cargar({ ...CERCA })
  await db.sql(`update negocios set estado = 'oculto', motivo_oculto = 'admin' where id = $1`, [oculto])
  await rechaza(reclamar(yo, oculto), /ya no se puede reclamar/)
  const reclamado = await cargar({ ...CERCA })
  await db.sql(`update negocios set estado = 'reclamado', owner_id = $2 where id = $1`, [reclamado, yo])
  await rechaza(reclamar(yo, reclamado), /ya no se puede reclamar/)
})

test('reclamar_negocio: tope de 3 reclamos vigentes', async () => {
  const yo = await buscador()
  const ns = [await cargar({ ...CERCA }), await cargar({ ...CERCA }), await cargar({ ...CERCA }), await cargar({ ...CERCA })]
  for (const n of ns.slice(0, 3)) await reclamar(yo, n)
  await rechaza(reclamar(yo, ns[3]), /3 reclamos pendientes/)
  await db.sql(`update negocio_reclamos set vence_at = now() - interval '1 day' where negocio_id = $1 and user_id = $2`, [ns[0], yo])
  assert.match(await reclamar(yo, ns[3]), /^[0-9A-F]{6}$/)
})

test('admin_resolver_reclamo: aprobar da el negocio, rechaza a los otros y avisa', async () => {
  const adm = await admin()
  const a = await buscador()
  const b = await buscador()
  const n = await cargar({ ...CERCA })
  await reclamar(a, n)
  await reclamar(b, n)
  const pendientes = await como(adm, 'select * from admin_reclamos_pendientes()')
  const delA = pendientes.find((x) => x.negocio_id === n && x.user_id === a)
  assert.ok(delA && delA.codigo && delA.email === MAIL)
  await como(adm, 'select admin_resolver_reclamo($1, true)', [delA.id])
  const neg = await db.uno('select estado, owner_id from negocios where id = $1', [n])
  assert.equal(neg.estado, 'reclamado')
  assert.equal(neg.owner_id, a)
  const estados = await db.sql(`select user_id, estado from negocio_reclamos where negocio_id = $1`, [n])
  assert.equal(estados.find((x) => x.user_id === a).estado, 'aprobado')
  assert.equal(estados.find((x) => x.user_id === b).estado, 'rechazado')
  const avisos = await db.sql(`select kind from notifications where user_id = $1`, [a])
  assert.ok(avisos.some((x) => x.kind === 'sistema'), 'avisa al nuevo dueño')
  const vistoPorA = (await cerca(a, 'plomero')).find((x) => x.id === n)
  assert.equal(vistoPorA.es_mio, true)
})

test('admin_resolver_reclamo: rechazar deja el negocio libre y avisa', async () => {
  const adm = await admin()
  const a = await buscador()
  const n = await cargar({ ...CERCA })
  await reclamar(a, n)
  const [r] = await como(adm, 'select * from admin_reclamos_pendientes()').then((l) => l.filter((x) => x.negocio_id === n))
  await como(adm, 'select admin_resolver_reclamo($1, false)', [r.id])
  assert.equal((await db.uno('select estado from negocios where id = $1', [n])).estado, 'sin_reclamar')
  assert.equal((await db.uno('select estado from negocio_reclamos where id = $1', [r.id])).estado, 'rechazado')
  assert.ok((await db.sql(`select 1 from notifications where user_id = $1 and kind = 'sistema'`, [a])).length >= 1)
})

test('admin_resolver_reclamo: no aprueba reclamos vencidos ni sobre un negocio ya reclamado', async () => {
  const adm = await admin()
  const a = await buscador()
  const n = await cargar({ ...CERCA })
  await reclamar(a, n)
  const [r] = await como(adm, 'select * from admin_reclamos_pendientes()').then((l) => l.filter((x) => x.negocio_id === n))
  await db.sql(`update negocio_reclamos set vence_at = now() - interval '1 minute' where id = $1`, [r.id])
  await rechaza(como(adm, 'select admin_resolver_reclamo($1, true)', [r.id]), /venció/)

  const b = await buscador()
  const n2 = await cargar({ ...CERCA })
  await reclamar(b, n2)
  const [r2] = await como(adm, 'select * from admin_reclamos_pendientes()').then((l) => l.filter((x) => x.negocio_id === n2))
  await db.sql(`update negocios set estado = 'reclamado', owner_id = $2 where id = $1`, [n2, a])
  await rechaza(como(adm, 'select admin_resolver_reclamo($1, true)', [r2.id]), /ya no se puede/)
})

test('admin_resolver_reclamo: un usuario comun no puede resolver ni listar', async () => {
  const a = await buscador()
  const n = await cargar({ ...CERCA })
  await reclamar(a, n)
  const [{ id }] = await db.sql('select id from negocio_reclamos where negocio_id = $1', [n])
  await rechaza(como(a, 'select admin_resolver_reclamo($1, true)', [id]), /administradores/)
  await rechaza(como(a, 'select * from admin_reclamos_pendientes()'), /administradores/)
})

test('admin_reclamos_pendientes: no lista los vencidos', async () => {
  const adm = await admin()
  const a = await buscador()
  const n = await cargar({ ...CERCA })
  await reclamar(a, n)
  await db.sql(`update negocio_reclamos set vence_at = now() - interval '1 minute' where negocio_id = $1`, [n])
  const l = await como(adm, 'select * from admin_reclamos_pendientes()')
  assert.ok(!l.some((x) => x.negocio_id === n))
  assert.equal((await como(a, 'select * from mi_reclamo($1)', [n])).length, 0)
})

test('invitado: reclamar_negocio y mi_reclamo rechazan con permission denied', async () => {
  const n = await cargar({ ...CERCA })
  await rechaza(como(null, 'select reclamar_negocio($1, $2)', [n, MAIL]), /permission denied/)
  await rechaza(como(null, 'select * from mi_reclamo($1)', [n]), /permission denied/)
  await rechaza(como(null, 'select * from admin_reclamos_pendientes()'), /permission denied/)
})
