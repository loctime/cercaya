// node --test --experimental-strip-types src/lib/version.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compararVersiones, versionObsoleta } from './version.ts'

test('compararVersiones: orden numerico, no alfabetico', () => {
  assert.ok(compararVersiones('1.2.0', '1.10.0') < 0)
  assert.ok(compararVersiones('2.0.0', '1.9.9') > 0)
  assert.equal(compararVersiones('1.2', '1.2.0'), 0)
})

test('versionObsoleta: solo si es menor que la minima', () => {
  assert.equal(versionObsoleta('1.1.0', '1.2.0'), true)
  assert.equal(versionObsoleta('1.2.0', '1.2.0'), false)
  assert.equal(versionObsoleta('1.3.0', '1.2.0'), false)
  assert.equal(versionObsoleta('1.0.0', null), false)
  assert.equal(versionObsoleta('1.0.0', ''), false)
})
