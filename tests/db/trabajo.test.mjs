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

// ---------------------------------------------------------------- catalogo ampliado (0113)

test('catalogo: tiene los oficios que propuso Marcelo y al menos 35 oficios', async () => {
  const ids = (await db.sql(`select id from habilidades_catalogo where tipo = 'oficio'`)).map((x) => x.id)
  for (const id of ['herrero', 'zinguero', 'cerrajero', 'carpintero', 'gasista', 'refrigeracion']) {
    assert.ok(ids.includes(id), `falta ${id}`)
  }
  assert.ok(ids.length >= 35, `solo hay ${ids.length} oficios`)
})

test('catalogo: frases de la gente encuentran el oficio correcto', async () => {
  const yo = await buscador()
  const casos = [
    ['cerrajero', 'Cerrajero', ['me quede afuera', 'abrir puerta', 'copia de llave']],
    ['refrigeracion', 'Refrigeración y aire', ['aire acondicionado', 'split']],
    ['gasista', 'Gasista', ['perdida de gas', 'calefon']],
    ['zinguero', 'Zinguero', ['canaleta']],
    ['herrero', 'Herrero', ['rejas', 'portones']],
    ['carpintero', 'Carpintero', ['placard']],
    ['mecanico', 'Mecánico', ['auto no arranca']],
    ['fletes', 'Fletes y mudanzas', ['mudanza', 'flete']],
  ]
  for (const [id, label, frases] of casos) {
    const pro = await ofrece(label, CERCA, [[label, id]])
    for (const frase of frases) {
      const r = await buscar(yo, frase)
      assert.ok(r.some((x) => x.user_id === pro), `"${frase}" tiene que encontrar a ${label}`)
    }
  }
})

test('catalogo: las etiquetas y los ids no se repiten', async () => {
  const r = await db.uno(`select count(*) n, count(distinct id) ids, count(distinct label) etiquetas from habilidades_catalogo`)
  assert.equal(Number(r.n), Number(r.ids))
  assert.equal(Number(r.n), Number(r.etiquetas))
})

// ---------------------------------------------------------------- disponibilidad (0114)

const disponibleHasta = async (id) => (await db.uno('select disponible_hasta from profile_private where user_id = $1', [id])).disponible_hasta

test('estoy_disponible: por defecto 8 horas, y se puede pedir de 1 a 24', async () => {
  const pro = await ofrece('Disponible', CERCA)
  const [{ estoy_disponible: hasta }] = await como(pro, 'select estoy_disponible() as estoy_disponible')
  const horas = (new Date(hasta) - Date.now()) / 3600000
  assert.ok(horas > 7.9 && horas < 8.1, `8 horas, dio ${horas}`)
  await como(pro, 'select estoy_disponible($1)', [24])
  await rechaza(como(pro, 'select estoy_disponible($1)', [0]), /horas/i)
  await rechaza(como(pro, 'select estoy_disponible($1)', [25]), /horas/i)
})

test('estoy_disponible: exige tener activo Ofrezco servicios', async () => {
  const sin = await ofrece('Sin activar', CERCA, [CANILLA], { activo: false })
  await rechaza(como(sin, 'select estoy_disponible()'), /Ofrezco servicios/i)
})

test('ya_no_disponible: limpia la disponibilidad', async () => {
  const pro = await ofrece('Se baja', CERCA)
  await como(pro, 'select estoy_disponible()')
  assert.ok(await disponibleHasta(pro))
  await como(pro, 'select ya_no_disponible()')
  assert.equal(await disponibleHasta(pro), null)
})

test('disponibilidad: apagar Ofrezco servicios la limpia, y nadie la edita a mano', async () => {
  const pro = await ofrece('Apaga todo', CERCA)
  await como(pro, 'select estoy_disponible()')
  await rechaza(
    como(pro, `update profile_private set disponible_hasta = now() + interval '100 days' where user_id = $1`, [pro]),
    /permission denied/i,
  )
  await como(pro, 'update profile_private set ofrece_servicios = false where user_id = $1', [pro])
  assert.equal(await disponibleHasta(pro), null)
})

test('buscar_servicio: los disponibles ahora salen primero aunque esten mas lejos', async () => {
  const yo = await buscador()
  const RELOJERO = [['Relojero Alfa', null]] // habilidad propia: aisla el test de los demas
  const cerca = await ofrece('Cerca no disponible', CERCA, RELOJERO)
  const lejos = await ofrece('Lejos disponible', VILLA, RELOJERO)
  await como(lejos, 'select estoy_disponible()')
  const r = await buscar(yo, 'relojero alfa')
  assert.deepEqual(r.map((x) => x.user_id), [lejos, cerca])
  assert.equal(r[0].disponible, true)
  assert.equal(r[1].disponible, false)
})

test('buscar_servicio: solo disponibles filtra, y una disponibilidad vencida no cuenta', async () => {
  const yo = await buscador()
  const ZAPATERO = [['Zapatero Beta', null]] // habilidad propia: aisla el test de los demas
  const activo = await ofrece('Activo ahora', CERCA, ZAPATERO)
  const vencido = await ofrece('Vencido', CERCA, ZAPATERO)
  await como(activo, 'select estoy_disponible()')
  await db.sql(`update profile_private set disponible_hasta = now() - interval '1 minute' where user_id = $1`, [vencido])
  const r = await como(yo, 'select * from buscar_servicio($1, $2, true)', ['zapatero beta', 15])
  assert.deepEqual(r.map((x) => x.user_id), [activo])
  const todos = await buscar(yo, 'zapatero beta')
  assert.equal(todos.find((x) => x.user_id === vencido).disponible, false)
})

test('acepta_pedidos: una habilidad apagada no se encuentra, y sin ninguna encendida no aparece', async () => {
  const yo = await buscador()
  const mixto = await ofrece('Mixto', CERCA, [CANILLA, LAMPARITA])
  await como(mixto, `update oficios set acepta_pedidos = false where user_id = $1 and catalog_id = 'arreglar-canilla'`, [mixto])
  assert.ok(!(await buscar(yo, 'canilla')).some((x) => x.user_id === mixto), 'apago la canilla')
  assert.ok((await buscar(yo, 'lamparita')).some((x) => x.user_id === mixto), 'sigue con la lamparita')
  await como(mixto, `update oficios set acepta_pedidos = false where user_id = $1`, [mixto])
  assert.ok(!(await buscar(yo, 'lamparita')).some((x) => x.user_id === mixto), 'todas apagadas')
})

test('acepta_pedidos: solo el dueño lo cambia', async () => {
  const dueno = await ofrece('Dueño de la habilidad', CERCA)
  const otro = await db.usuario(nombre('Otro'), RAMALLO)
  const r = await como(otro, 'update oficios set acepta_pedidos = false where user_id = $1 returning 1', [dueno])
  assert.equal(r.length, 0)
})

test('avisar_disponibilidad: avisa a quien ofrece y no esta disponible, una vez por dia y respetando preferencias', async () => {
  const quiere = await ofrece('Quiere aviso', CERCA)
  const yaDisponible = await ofrece('Ya disponible', CERCA)
  await como(yaDisponible, 'select estoy_disponible()')
  const noOfrece = await ofrece('No ofrece', CERCA, [CANILLA], { activo: false })
  const noQuiere = await ofrece('No quiere aviso', CERCA)
  await db.sql('update notification_prefs set disponibilidad = false where user_id = $1', [noQuiere])
  const avisos = (id) => db.uno(`select count(*)::int n from notifications where user_id = $1 and kind = 'disponibilidad'`, [id])

  await db.sql('select avisar_disponibilidad()')
  assert.equal((await avisos(quiere)).n, 1)
  assert.equal((await avisos(yaDisponible)).n, 0)
  assert.equal((await avisos(noOfrece)).n, 0)
  assert.equal((await avisos(noQuiere)).n, 0)

  await db.sql('select avisar_disponibilidad()')
  assert.equal((await avisos(quiere)).n, 1, 'no repite el mismo dia')
})

// ---------------------------------------------------------------- revision de disponibilidad y catalogo (0115)

test('catalogo: se encuentra por el nombre de la persona (tapicero, costurera, peluquera...)', async () => {
  const yo = await buscador()
  const casos = [
    ['tapicero', 'Tapicería', ['tapicero', 'tapicera']],
    ['fumigador', 'Fumigación y control de plagas', ['fumigador', 'fumigadora']],
    ['costurera', 'Costura y arreglos de ropa', ['costurera', 'costurero']],
    ['colocador-pisos', 'Colocación de pisos y revestimientos', ['colocador de pisos', 'colocadora']],
    ['fletes', 'Fletes y mudanzas', ['fletero']],
    ['diseno-grafico', 'Diseño gráfico', ['diseñador', 'diseñadora', 'disenador grafico']],
    ['peluquero', 'Peluquero/a', ['peluquera']],
    ['cocinero', 'Cocinero/a y catering', ['cocinera']],
    ['fotografo', 'Fotógrafo/a', ['fotografa']],
    ['herrero', 'Herrero', ['herrera']],
    ['plomero', 'Plomero', ['plomera']],
    ['cerrajero', 'Cerrajero', ['cerrajera']],
    ['carpintero', 'Carpintero', ['carpintera']],
    ['pintor', 'Pintor', ['pintora']],
    ['jardinero', 'Jardinero', ['jardinera']],
  ]
  for (const [id, label, frases] of casos) {
    const pro = await ofrece(label, CERCA, [[label, id]])
    for (const frase of frases) {
      assert.ok((await buscar(yo, frase)).some((x) => x.user_id === pro), `"${frase}" tiene que encontrar a ${label}`)
    }
  }
})

test('oficios: uno escrito a mano que coincide con el catalogo se vincula solo y gana los sinonimos', async () => {
  const yo = await buscador()
  const manual = await ofrece('Gasista manual', CERCA, [['gasista', null]])
  const fila = await db.uno('select catalog_id, tipo from oficios where user_id = $1', [manual])
  assert.equal(fila.catalog_id, 'gasista')
  assert.ok((await buscar(yo, 'calefon')).some((x) => x.user_id === manual))
})

test('catalogo: no promete lo que no se puede verificar (matriculado, enfermera, kinesiologo)', async () => {
  const yo = await buscador()
  const gasista = await ofrece('Gasista sin matricula verificada', CERCA, [['Gasista', 'gasista']])
  const cuidador = await ofrece('Cuidador', CERCA, [['Cuidado de adultos mayores', 'cuidador-mayores']])
  const masajista = await ofrece('Masajista', CERCA, [['Masajista', 'masajista']])
  assert.ok(!(await buscar(yo, 'gasista matriculado')).some((x) => x.user_id === gasista))
  assert.ok(!(await buscar(yo, 'enfermera')).some((x) => x.user_id === cuidador))
  assert.ok(!(await buscar(yo, 'kinesiologo')).some((x) => x.user_id === masajista))
})

test('estoy_disponible: exige alguna habilidad que acepte pedidos', async () => {
  const pro = await ofrece('Todo apagado', CERCA)
  await como(pro, 'update oficios set acepta_pedidos = false where user_id = $1', [pro])
  await rechaza(como(pro, 'select estoy_disponible()'), /habilidad/i)
})

test('avisar_disponibilidad: no avisa a quien no aparece en ninguna busqueda', async () => {
  const aparece = await ofrece('Aparece', CERCA)
  const ubicacionVieja = await ofrece('Ubicacion vieja', CERCA)
  await db.sql(`update profile_private set location_updated_at = now() - interval '200 days' where user_id = $1`, [ubicacionVieja])
  const todoApagado = await ofrece('Habilidades apagadas', CERCA)
  await db.sql('update oficios set acepta_pedidos = false where user_id = $1', [todoApagado])
  const avisos = (id) => db.uno(`select count(*)::int n from notifications where user_id = $1 and kind = 'disponibilidad'`, [id])
  await db.sql(`delete from notifications where kind = 'disponibilidad'`)
  await db.sql('select avisar_disponibilidad()')
  assert.equal((await avisos(aparece)).n, 1)
  assert.equal((await avisos(ubicacionVieja)).n, 0)
  assert.equal((await avisos(todoApagado)).n, 0)
})
