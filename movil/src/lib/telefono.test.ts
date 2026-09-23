// node --test --experimental-strip-types src/lib/telefono.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numeroWhatsApp } from './telefono.ts'

test('formatos comunes de Ramallo (area 3407)', () => {
  const esperado = '5493407123456'
  for (const n of ['3407 123456', '03407 123456', '3407 15 123456', '03407-15-123456', '+54 9 3407 123456', '5493407123456', '543407123456']) {
    assert.equal(numeroWhatsApp(n), esperado, n)
  }
})

test('areas de 2 y 4 digitos', () => {
  assert.equal(numeroWhatsApp('011 15 1234 5678'), '5491112345678')
  assert.equal(numeroWhatsApp('336 15 4123456'), '5493364123456')
})

test('numeros invalidos', () => {
  assert.equal(numeroWhatsApp('123'), null)
  assert.equal(numeroWhatsApp(''), null)
})
