import test from 'node:test'
import assert from 'node:assert/strict'
import { textoHace, debeActualizar } from './tiempo.ts'
test('tiempo', () => { const n=new Date('2026-10-20T12:00:00Z'); assert.equal(textoHace('2026-10-20T11:55:00Z',n),'hace 5 min'); assert.equal(textoHace('2026-10-19T12:00:00Z',n),'hace más de un día'); assert.equal(debeActualizar('2026-10-20T11:50:00Z',n),true) })
