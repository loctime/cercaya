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

// ---------------------------------------------------------------- bajas

const baja = (userId, negocio, motivo = null) => como(userId, 'select pedir_baja_negocio($1, $2)', [negocio, motivo])
const bajasAdmin = (adm, estado) => como(adm, 'select * from admin_bajas($1)', [estado])

test('pedir_baja_negocio: oculta en el momento y queda pendiente de revision', async () => {
  const adm = await admin()
  const yo = await buscador()
  const n = await cargar({ nombre: 'Plomeria Baja', ...CERCA })
  assert.ok((await cerca(yo, 'plomeria baja')).some((x) => x.id === n))
  await baja(yo, n, 'No es mi negocio')
  assert.ok(!(await cerca(yo, 'plomeria baja')).some((x) => x.id === n), 'desaparece al instante')
  const fila = await db.uno('select estado, motivo_oculto from negocios where id = $1', [n])
  assert.equal(fila.estado, 'oculto')
  assert.equal(fila.motivo_oculto, 'baja')
  const pendientes = await bajasAdmin(adm, 'pendiente')
  const b = pendientes.find((x) => x.negocio_id === n)
  assert.ok(b)
  assert.equal(b.motivo, 'No es mi negocio')
  assert.equal(b.instagram_usuario, (await db.uno('select instagram_usuario from negocios where id = $1', [n])).instagram_usuario)
})

test('pedir_baja_negocio: no se puede sobre un negocio reclamado ni sobre uno ya oculto', async () => {
  const yo = await buscador()
  const otro = await buscador()
  const reclamado = await cargar({ ...CERCA })
  await db.sql(`update negocios set estado = 'reclamado', owner_id = $2 where id = $1`, [reclamado, otro])
  await rechaza(baja(yo, reclamado), /tiene dueño/)
  assert.equal((await db.uno('select estado from negocios where id = $1', [reclamado])).estado, 'reclamado')
  const oculto = await cargar({ ...CERCA })
  await baja(yo, oculto)
  await rechaza(baja(yo, oculto), /ya está oculto/)
})

test('pedir_baja_negocio: tope de 10 por dia por usuario', async () => {
  const yo = await buscador()
  const otro = await buscador()
  const ns = []
  for (let i = 0; i < 11; i++) ns.push(await cargar({ ...CERCA }))
  for (const n of ns.slice(0, 10)) await baja(yo, n)
  await rechaza(baja(yo, ns[10]), /máximo de bajas de hoy/)
  await baja(otro, ns[10])
})

test('admin_resolver_baja: confirmar deja el negocio oculto y devolver lo restaura', async () => {
  const adm = await admin()
  const yo = await buscador()
  const n1 = await cargar({ nombre: 'Plomeria Confirma', ...CERCA })
  const n2 = await cargar({ nombre: 'Plomeria Devuelve', ...CERCA })
  await baja(yo, n1)
  await baja(yo, n2)
  const pend = await bajasAdmin(adm, 'pendiente')
  const b1 = pend.find((x) => x.negocio_id === n1)
  const b2 = pend.find((x) => x.negocio_id === n2)
  await como(adm, 'select admin_resolver_baja($1, true)', [b1.id])
  await como(adm, 'select admin_resolver_baja($1, false)', [b2.id])
  assert.equal((await db.uno('select estado from negocios where id = $1', [n1])).estado, 'oculto')
  const n2fila = await db.uno('select estado, motivo_oculto from negocios where id = $1', [n2])
  assert.equal(n2fila.estado, 'sin_reclamar')
  assert.equal(n2fila.motivo_oculto, null)
  assert.ok((await cerca(yo, 'plomeria devuelve')).some((x) => x.id === n2))
  assert.ok(!(await bajasAdmin(adm, 'pendiente')).some((x) => x.negocio_id === n1 || x.negocio_id === n2))
})

test('admin_resolver_baja: restaurar una baja ya confirmada', async () => {
  const adm = await admin()
  const yo = await buscador()
  const n = await cargar({ nombre: 'Plomeria Restaura', ...CERCA })
  await baja(yo, n)
  const [b] = (await bajasAdmin(adm, 'pendiente')).filter((x) => x.negocio_id === n)
  await como(adm, 'select admin_resolver_baja($1, true)', [b.id])
  const conf = (await bajasAdmin(adm, 'confirmada')).find((x) => x.negocio_id === n)
  assert.ok(conf)
  await como(adm, 'select admin_resolver_baja($1, false)', [conf.id])
  assert.equal((await db.uno('select estado from negocios where id = $1', [n])).estado, 'sin_reclamar')
})

test('admin_ocultar_negocio: oculta y queda en admin_bajas confirmada', async () => {
  const adm = await admin()
  const yo = await buscador()
  const n = await cargar({ nombre: 'Plomeria Por Mail', ...CERCA })
  await como(adm, 'select admin_ocultar_negocio($1, $2)', [n, 'Lo pidió por mail'])
  const fila = await db.uno('select estado, motivo_oculto from negocios where id = $1', [n])
  assert.equal(fila.estado, 'oculto')
  assert.equal(fila.motivo_oculto, 'admin')
  assert.ok(!(await cerca(yo, 'plomeria por mail')).some((x) => x.id === n))
  const conf = (await bajasAdmin(adm, 'confirmada')).find((x) => x.negocio_id === n)
  assert.ok(conf)
  assert.equal(conf.motivo, 'Lo pidió por mail')
})

test('bajas: un usuario comun no usa admin_* e invitados rechazan', async () => {
  const yo = await buscador()
  const n = await cargar({ ...CERCA })
  await rechaza(como(yo, `select * from admin_bajas('pendiente')`), /administradores/)
  await rechaza(como(yo, 'select admin_ocultar_negocio($1, null)', [n]), /administradores/)
  await rechaza(como(yo, 'select admin_resolver_baja($1, true)', ['00000000-0000-0000-0000-000000000000']), /administradores/)
  await rechaza(como(null, 'select pedir_baja_negocio($1, null)', [n]), /permission denied/)
  await rechaza(como(null, `select * from admin_bajas('pendiente')`), /permission denied/)
})

// ---------------------------------------------------------------- dueño

// Negocio ya reclamado por `dueno` (como lo deja admin_resolver_reclamo).
async function reclamado(dueno, datos = {}) {
  const n = await cargar({ ...CERCA, ...datos })
  await db.sql(`update negocios set estado = 'reclamado', owner_id = $2 where id = $1`, [n, dueno])
  return n
}

test('editar_mi_negocio: el dueño cambia nombre, bio, telefono, tipo y ubicacion', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno, { nombre: 'Antes', tipo: 'a_domicilio' })
  await como(dueno, `select editar_mi_negocio($1, 'Despues S.A.', 'Hacemos de todo', '3407123456', 'local', -33.49, -60.02)`, [n])
  const f = await db.uno('select nombre, bio, telefono, tipo, lat, lng from negocios where id = $1', [n])
  assert.deepEqual(
    { ...f, lat: Number(f.lat), lng: Number(f.lng) },
    { nombre: 'Despues S.A.', bio: 'Hacemos de todo', telefono: '3407123456', tipo: 'local', lat: -33.49, lng: -60.02 },
  )
})

test('editar_mi_negocio: un tercero no puede editar un negocio ajeno', async () => {
  const dueno = await buscador()
  const otro = await buscador()
  const n = await reclamado(dueno)
  await rechaza(como(otro, `select editar_mi_negocio($1, 'Robado')`, [n]), /no es tuyo/)
  const sinDueno = await cargar({ ...CERCA })
  await rechaza(como(otro, `select editar_mi_negocio($1, 'Robado')`, [sinDueno]), /no es tuyo/)
})

test('editar_mi_negocio: cadena vacia borra el telefono; lat sin lng rechaza', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno, { telefono: '3407000000', bio: 'Algo' })
  await como(dueno, `select editar_mi_negocio($1, null, '', '')`, [n])
  const f = await db.uno('select telefono, bio, nombre from negocios where id = $1', [n])
  assert.equal(f.telefono, null)
  assert.equal(f.bio, null)
  assert.ok(f.nombre)
  await rechaza(como(dueno, `select editar_mi_negocio($1, null, null, null, null, -33.5, null)`, [n]), /ubicación/)
})

test('ocultar_mi_negocio: oculta, desaparece de negocios_cerca y vuelve a mostrarse', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno, { nombre: 'Plomeria Propia' })
  assert.ok((await cerca(dueno, 'plomeria propia')).some((x) => x.id === n))
  await como(dueno, 'select ocultar_mi_negocio($1, true)', [n])
  assert.ok(!(await cerca(dueno, 'plomeria propia')).some((x) => x.id === n), 'oculto tambien para el dueño')
  assert.equal((await db.uno('select motivo_oculto from negocios where id = $1', [n])).motivo_oculto, 'dueno')
  await como(dueno, 'select ocultar_mi_negocio($1, false)', [n])
  assert.ok((await cerca(dueno, 'plomeria propia')).some((x) => x.id === n))
  assert.equal((await db.uno('select estado from negocios where id = $1', [n])).estado, 'reclamado')
})

test('ocultar_mi_negocio: no vuelve a mostrar uno ocultado por el equipo', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno)
  await db.sql(`update negocios set estado = 'oculto', motivo_oculto = 'admin' where id = $1`, [n])
  await rechaza(como(dueno, 'select ocultar_mi_negocio($1, false)', [n]), /equipo de CercaYa/)
  assert.equal((await db.uno('select estado from negocios where id = $1', [n])).estado, 'oculto')
})

test('borrar la cuenta del dueño deja el negocio oculto, no reclamado sin dueño', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno)
  await db.sql('delete from profiles where id = $1', [dueno])
  const f = await db.uno('select estado, motivo_oculto, owner_id from negocios where id = $1', [n])
  assert.equal(f.owner_id, null)
  assert.equal(f.estado, 'oculto')
  assert.equal(f.motivo_oculto, 'cuenta')
})

test('mis_negocios: lista los propios, incluidos los ocultos, y no los ajenos', async () => {
  const dueno = await buscador()
  const otro = await buscador()
  const propio = await reclamado(dueno, { nombre: 'Mio Visible' })
  const oculto = await reclamado(dueno, { nombre: 'Mio Oculto' })
  await como(dueno, 'select ocultar_mi_negocio($1, true)', [oculto])
  const ajeno = await reclamado(otro, { nombre: 'Ajeno' })
  const mios = await como(dueno, 'select * from mis_negocios()')
  const ids = mios.map((x) => x.id)
  assert.ok(ids.includes(propio) && ids.includes(oculto))
  assert.ok(!ids.includes(ajeno))
  assert.equal(mios.find((x) => x.id === oculto).motivo_oculto, 'dueno')
})

test('dueño: invitados rechazan con permission denied', async () => {
  const dueno = await buscador()
  const n = await reclamado(dueno)
  await rechaza(como(null, `select editar_mi_negocio($1, 'X')`, [n]), /permission denied/)
  await rechaza(como(null, 'select ocultar_mi_negocio($1, true)', [n]), /permission denied/)
  await rechaza(como(null, 'select * from mis_negocios()'), /permission denied/)
})
