import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parsearCsv } from '../../scripts/negocios-csv.mjs'

const CATALOGO = new Set(['panadero', 'plomero', 'electricista'])
const CABECERA = 'instagram,nombre,rubro,tipo,lat,lng,telefono,bio\n'

test('parsearCsv: lee las filas validas del ejemplo', () => {
  const { filas, errores } = parsearCsv(readFileSync('scripts/negocios-ejemplo.csv', 'utf8'), CATALOGO)
  assert.deepEqual(errores, [])
  assert.equal(filas.length, 2)
  assert.deepEqual(filas[0], {
    instagram: 'electricidad.lopez', nombre: 'Electricidad López, desde 1985', rubro: 'electricista', tipo: 'local',
    lat: -33.4851, lng: -60.0172, telefono: '3407123456', bio: 'Instalaciones y reparaciones',
  })
  assert.equal(filas[1].telefono, null)
  assert.equal(filas[1].tipo, 'a_domicilio')
})

test('parsearCsv: normaliza @Instagram y acepta comillas con comas', () => {
  const csv = CABECERA + '@Mi.Negocio,"Pérez, Hnos",plomero,local,-33.48,-60.01,,"Hola, mundo"\n'
  const { filas, errores } = parsearCsv(csv, CATALOGO)
  assert.deepEqual(errores, [])
  assert.equal(filas[0].instagram, 'mi.negocio')
  assert.equal(filas[0].nombre, 'Pérez, Hnos')
  assert.equal(filas[0].bio, 'Hola, mundo')
})

test('parsearCsv: rechaza rubro desconocido, tipo invalido, coordenadas malas e Instagram repetido', () => {
  const csv = CABECERA + [
    'a.uno,Uno,inventado,local,-33.48,-60.01,,',      // linea 2: rubro
    'a.dos,Dos,plomero,en_la_luna,-33.48,-60.01,,',   // linea 3: tipo
    'a.tres,Tres,plomero,local,-10,-60.01,,',         // linea 4: fuera de zona
    'a.cuatro,Cuatro,plomero,local,abc,-60.01,,',     // linea 5: no numerica
    'a.cinco,Cinco,plomero,local,-33.48,-60.01,,',    // linea 6: ok
    '@A.Cinco,Cinco bis,plomero,local,-33.48,-60.01,,', // linea 7: repetido
  ].join('\n') + '\n'
  const { filas, errores } = parsearCsv(csv, CATALOGO)
  assert.deepEqual(errores.map((e) => e.linea), [2, 3, 4, 5, 7])
  assert.match(errores[0].motivo, /rubro/i)
  assert.match(errores[1].motivo, /tipo/i)
  assert.match(errores[2].motivo, /zona/i)
  assert.match(errores[3].motivo, /número|numérica|coordenada/i)
  assert.match(errores[4].motivo, /repetido|duplicado/i)
  assert.deepEqual(filas.map((f) => f.instagram), ['a.cinco'])
})

test('parsearCsv: una fila mala no impide leer las buenas', () => {
  const csv = CABECERA + 'malo,X,plomero,local,-33.48,-60.01,,\nbueno.uno,Bueno Uno,plomero,local,-33.48,-60.01,,\n'
  const { filas, errores } = parsearCsv(csv, CATALOGO)
  assert.equal(filas.length, 1)
  assert.equal(errores.length, 1)
  assert.equal(errores[0].linea, 2)
})

test('parsearCsv: acepta San Nicolás de los Arroyos (cliente real fuera de Ramallo)', () => {
  const csv = CABECERA + 'od.micaelapineiro,Od. Micaela Piñeiro,plomero,local,-33.3345,-60.2250,3364386381,\n'
  const { filas, errores } = parsearCsv(csv, CATALOGO)
  assert.deepEqual(errores, [])
  assert.equal(filas.length, 1)
})
