// node --test --experimental-strip-types src/lib/trabajo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consultaValida, nuevaSecuencia } from './trabajo.ts'

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
