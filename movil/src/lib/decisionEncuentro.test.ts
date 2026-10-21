// node --test --experimental-strip-types src/lib/decisionEncuentro.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidirTrasSync } from './decisionEncuentro.ts'

test('activo sin llegada: sigue y no avisa', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: false }, false), {
    detener: false,
    avisarLlegada: false,
  })
})

test('activo con llegada: avisa una vez', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: true }, false), {
    detener: false,
    avisarLlegada: true,
  })
  assert.deepEqual(decidirTrasSync({ estado: 'activo', llegaron: true }, true), {
    detener: false,
    avisarLlegada: false,
  })
})

test('pendiente: sigue enviando para estar listo cuando acepten', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'pendiente', llegaron: false }, false), {
    detener: false,
    avisarLlegada: false,
  })
})

test('terminado, rechazado o vencido: detiene el servicio', () => {
  for (const estado of ['terminado', 'rechazado', 'vencido']) {
    assert.deepEqual(
      decidirTrasSync({ estado, llegaron: false }, false),
      { detener: true, avisarLlegada: false },
      estado,
    )
  }
})

test('una llegada con el encuentro ya terminado no avisa', () => {
  assert.deepEqual(decidirTrasSync({ estado: 'terminado', llegaron: true }, false), {
    detener: true,
    avisarLlegada: false,
  })
})
