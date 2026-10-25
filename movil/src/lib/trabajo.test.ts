// node --test --experimental-strip-types src/lib/trabajo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consultaValida, disponibleAhora, nuevaSecuencia, textoDisponibleHasta } from './trabajo.ts'

test('consultaValida: exige 2 letras reales', () => {
  assert.equal(consultaValida('ca'), true)
  assert.equal(consultaValida('Cañilla'), true)
  assert.equal(consultaValida('a1'), true)
  assert.equal(consultaValida('  c '), false)
  for (const vacio of ['', '   ', '¿?', '%', '_']) assert.equal(consultaValida(vacio), false, `"${vacio}"`)
})

test('nuevaSecuencia: la consulta vieja deja de ser vigente', () => {
  const nueva = nuevaSecuencia()
  const a = nueva()
  const b = nueva()
  assert.equal(a(), false)
  assert.equal(b(), true)
  nueva()
  assert.equal(b(), false)
})

test('nuevaSecuencia: una respuesta lenta no pisa a la nueva', async () => {
  const nueva = nuevaSecuencia()
  let pantalla = ''
  const buscar = async (texto: string, demoraMs: number) => {
    const vigente = nueva()
    await new Promise((r) => setTimeout(r, demoraMs))
    if (vigente()) pantalla = texto
  }
  // La primera tarda mas que la segunda: termina despues y no debe pisarla.
  await Promise.all([buscar('canil', 40), buscar('canilla rota', 5)])
  assert.equal(pantalla, 'canilla rota')
})

test('disponibleAhora: solo con una fecha futura', () => {
  const ahora = new Date('2026-10-24T15:00:00Z')
  assert.equal(disponibleAhora(null, ahora), false)
  assert.equal(disponibleAhora(undefined, ahora), false)
  assert.equal(disponibleAhora('2026-10-24T14:59:59Z', ahora), false)
  assert.equal(disponibleAhora('2026-10-24T15:00:00Z', ahora), false)
  assert.equal(disponibleAhora('2026-10-24T23:00:00Z', ahora), true)
  assert.equal(disponibleAhora('no es una fecha', ahora), false)
})

test('textoDisponibleHasta: hora local con minutos de dos digitos', () => {
  assert.equal(textoDisponibleHasta(new Date(2026, 9, 24, 18, 30).toISOString()), 'hasta las 18:30')
  assert.equal(textoDisponibleHasta(new Date(2026, 9, 24, 9, 5).toISOString()), 'hasta las 9:05')
  assert.equal(textoDisponibleHasta(new Date(2026, 9, 24, 0, 0).toISOString()), 'hasta las 0:00')
})
