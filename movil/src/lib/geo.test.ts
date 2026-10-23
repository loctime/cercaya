// node --test --experimental-strip-types src/lib/geo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distanciaM, giroFlecha, rumboGrados, textoCardinal, textoDistancia } from './geo.ts'

const cerca = (real: number, esperado: number, margen: number) =>
  assert.ok(Math.abs(real - esperado) <= margen, `${real} no esta a ${margen} de ${esperado}`)

test('distanciaM: mismo punto es 0 y 0,001 grados de latitud son ~111 m', () => {
  assert.equal(distanciaM(-33.48, -60.01, -33.48, -60.01), 0)
  cerca(distanciaM(-33.48, -60.01, -33.479, -60.01), 111, 2)
})

test('rumboGrados: norte 0, este 90, sur 180, oeste 270', () => {
  cerca(rumboGrados(-33.48, -60.01, -33.47, -60.01), 0, 1)
  cerca(rumboGrados(-33.48, -60.01, -33.48, -60.0), 90, 1)
  cerca(rumboGrados(-33.48, -60.01, -33.49, -60.01), 180, 1)
  cerca(rumboGrados(-33.48, -60.01, -33.48, -60.02), 270, 1)
})

test('giroFlecha: da el camino corto al cruzar 0/360 y queda en [0, 360)', () => {
  assert.equal(giroFlecha(10, 350), 20)
  assert.equal(giroFlecha(350, 10), 340)
  assert.equal(giroFlecha(0, 0), 0)
  assert.equal(giroFlecha(90, 180), 270)
  assert.equal(giroFlecha(5, 5), 0)
})

test('textoDistancia: metros, kilometros y coma decimal', () => {
  assert.equal(textoDistancia(0), '0 m')
  assert.equal(textoDistancia(850), '850 m')
  assert.equal(textoDistancia(999.6), '1 km')
  assert.equal(textoDistancia(1000), '1 km')
  assert.equal(textoDistancia(1530), '1,5 km')
  assert.equal(textoDistancia(12000), '12 km')
})

test('textoCardinal: ocho direcciones, y 359 vuelve a norte', () => {
  assert.equal(textoCardinal(0), 'norte')
  assert.equal(textoCardinal(45), 'noreste')
  assert.equal(textoCardinal(270), 'oeste')
  assert.equal(textoCardinal(359), 'norte')
})
