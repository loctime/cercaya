// node --test --experimental-strip-types src/lib/tiempo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { debeActualizar, textoHace } from './tiempo.ts'

const AHORA = new Date('2026-10-20T12:00:00Z')
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * 60000).toISOString()

test('textoHace: segundos, minutos y horas', () => {
  assert.equal(textoHace(new Date(AHORA.getTime() - 20000).toISOString(), AHORA), 'recién')
  assert.equal(textoHace(hace(5), AHORA), 'hace 5 min')
  assert.equal(textoHace(hace(59), AHORA), 'hace 59 min')
  assert.equal(textoHace(hace(60), AHORA), 'hace 1 h')
  assert.equal(textoHace(hace(5 * 60), AHORA), 'hace 5 h')
  assert.equal(textoHace(hace(23 * 60 + 59), AHORA), 'hace 23 h')
})

test('textoHace: un dia o mas, y fechas futuras', () => {
  assert.equal(textoHace(hace(24 * 60), AHORA), 'hace más de un día')
  assert.equal(textoHace(hace(3 * 24 * 60), AHORA), 'hace más de un día')
  assert.equal(textoHace(hace(-5), AHORA), 'recién')
})

test('debeActualizar: sin dato, antes y despues de los 10 minutos', () => {
  assert.equal(debeActualizar(null, AHORA), true)
  assert.equal(debeActualizar(hace(9), AHORA), false)
  assert.equal(debeActualizar(hace(10), AHORA), true)
  assert.equal(debeActualizar(hace(6), AHORA, 5), true)
})
