// node --test --experimental-strip-types src/lib/negociosTexto.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INSTAGRAM_OFICIAL, diasRestantes, textoMensajeCodigo, urlInstagram, urlInstagramOficial, urlWhatsApp,
} from './negociosTexto.ts'

test('urlInstagram y urlInstagramOficial apuntan al perfil', () => {
  assert.equal(INSTAGRAM_OFICIAL, 'cercaya')
  assert.equal(urlInstagram('panaderia.lopez'), 'https://instagram.com/panaderia.lopez')
  assert.equal(urlInstagramOficial(), 'https://instagram.com/cercaya')
})

test('textoMensajeCodigo incluye el codigo', () => {
  const t = textoMensajeCodigo('A3F9C2')
  assert.ok(t.includes('A3F9C2'))
  assert.ok(t.includes('CercaYa'))
})

test('diasRestantes redondea para arriba y no baja de 0', () => {
  const ahora = new Date('2026-11-15T12:00:00Z')
  assert.equal(diasRestantes('2026-11-21T13:00:00Z', ahora), 7)
  assert.equal(diasRestantes('2026-11-16T11:00:00Z', ahora), 1)
  assert.equal(diasRestantes('2026-11-10T00:00:00Z', ahora), 0)
  assert.equal(diasRestantes('basura', ahora), 0)
})

test('urlWhatsApp: numero argentino valido o null', () => {
  assert.equal(urlWhatsApp('3407 15 123456'), 'https://wa.me/5493407123456')
  assert.equal(urlWhatsApp(''), null)
  assert.equal(urlWhatsApp('abc'), null)
  assert.equal(urlWhatsApp(null), null)
})
