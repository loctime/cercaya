// node --test --experimental-strip-types src/lib/decisionEncuentro.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirTrasSync, errorTerminal, lecturaFresca } from './decisionEncuentro.ts'

const SIN = { detener: false, avisarLlegada: false, rearmar: false }

test('activo sin llegada: sigue y no avisa', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: false, distancia_m: 300 }, false), {
    ...SIN,
    rearmar: true,
  })
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: false }, false), SIN)
})

test('activo con llegada: avisa una vez', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: true, distancia_m: 30 }, false), {
    ...SIN,
    avisarLlegada: true,
  })
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: true, distancia_m: 30 }, true), SIN)
})

test('pendiente: sigue enviando para estar listo cuando acepten', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'pendiente', llegaron: false }, false), SIN)
})

test('terminado, rechazado o vencido: detiene el servicio', () => {
  for (const estado of ['terminado', 'rechazado', 'vencido']) {
    assert.deepEqual(decidirTrasSync({ estado, llegaron: false }, false), { ...SIN, detener: true }, estado)
  }
})

test('una llegada con el encuentro ya terminado no avisa', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'terminado', llegaron: true }, false), { ...SIN, detener: true })
})

test('el GPS oscilando alrededor de los 50 m no rearma el aviso (48, 52, 49 m)', () => {
  assert.equal(decidirTrasSync({ estado: 'activo', llegaron: false, distancia_m: 52 }, true).rearmar, false)
  assert.equal(decidirTrasSync({ estado: 'activo', llegaron: false, distancia_m: 99 }, true).rearmar, false)
})

test('separarse mas de 100 m rearma el aviso para la proxima llegada', () => {
  assert.equal(decidirTrasSync({ estado: 'activo', llegaron: false, distancia_m: 101 }, true).rearmar, true)
})

test('sin distancia (el otro no mando posicion) no rearma', () => {
  assert.equal(decidirTrasSync({ estado: 'activo', llegaron: false, distancia_m: null }, true).rearmar, false)
})

test('errorTerminal: sesion o permisos perdidos detienen el servicio; la red no', () => {
  for (const m of [
    'No sos parte de este encuentro',
    'permission denied for function encuentro_sync',
    'JWT expired',
    'Necesitas iniciar sesion',
  ]) {
    assert.equal(errorTerminal(m), true, m)
  }
  for (const m of ['Network request failed', 'Failed to fetch', '']) assert.equal(errorTerminal(m), false, m)
})

test('lecturaFresca: hasta 30 s sirve; mas vieja o inexistente no', () => {
  assert.equal(lecturaFresca(1_000_000 - 29_000, 1_000_000), true)
  assert.equal(lecturaFresca(1_000_000 - 31_000, 1_000_000), false)
  assert.equal(lecturaFresca(null, 1_000_000), false)
  assert.equal(lecturaFresca(1_000_000 - 40_000, 1_000_000, 60_000), true)
})
