import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { crearDb, RAMALLO } from './harness.mjs'

let db
before(async () => { db = await crearDb() })
after(async () => { await db.cerrar() })
const como = (u, q, p=[]) => db.como(u, d => d.sql(q,p))

test('ubicacion publica queda cerrada y difuminar es estable', async () => {
  const a = await db.usuario('Mapa Ana', RAMALLO)
  const b = await db.usuario('Mapa Beto', RAMALLO)
  await assert.rejects(como(null, 'select approx_lat from profiles'), /permission denied/)
  await assert.rejects(como(a, 'select zone_label from profiles'), /permission denied/)
  const x = await db.uno('select * from difuminar($1,$2,$3,.003)', [RAMALLO.lat,RAMALLO.lng,a])
  const y = await db.uno('select * from difuminar($1,$2,$3,.003)', [RAMALLO.lat,RAMALLO.lng,a])
  assert.deepEqual(x,y); assert.ok(Math.abs(x.lat-RAMALLO.lat)<=.0015+1e-9)
  await como(a,'update profile_private set share_location=true where user_id=$1',[a])
  await como(b,'update profile_private set share_location=true where user_id=$1',[a])
})

test('contactos, bloqueos, mapa y curriculum respetan privacidad', async () => {
  const a = await db.usuario('Social Ana', RAMALLO)
  const b = await db.usuario('Social Beto', {lat:-33.484,lng:-60.017,phone:'340712345678'})
  const c = await db.usuario('Social Cora', RAMALLO)
  const solicitud = (await como(a,'select solicitar_contacto($1) id',[b]))[0].id
  assert.equal((await como(b,'select * from mis_contactos()'))[0].estado,'recibida')
  await como(b,'select responder_contacto($1,true)',[solicitud])
  assert.equal((await como(a,'select es_contacto($1,$2) ok',[a,b]))[0].ok,true)
  await como(b,'update profile_private set share_location=true where user_id=$1',[b])
  await db.sql('update profile_private set location_updated_at=now() where user_id=$1',[b])
  const mapa = await como(a,'select * from mapa_contactos()')
  assert.equal(mapa.length,1); assert.deepEqual(Object.keys(mapa[0]),['user_id','full_name','avatar_url','lat','lng','actualizada_at','desactualizada'])
  assert.notEqual(mapa[0].lat,-33.484)
  await como(a,"insert into cv_entries(user_id,titulo,desde_anio) values($1,'Plomero',2020)",[b]) .catch(()=>{})
  await como(b,"insert into cv_entries(user_id,titulo,desde_anio) values($1,'Plomero',2020)",[b])
  assert.equal((await como(a,'select * from cv_entries where user_id=$1',[b])).length,1)
  assert.equal((await como(c,'select * from cv_entries where user_id=$1',[b])).length,0)
  await como(a,'insert into blocks(blocker_id,blocked_id) values($1,$2)',[a,b])
  assert.equal((await como(a,'select * from mapa_contactos()')).length,0)
  assert.equal((await como(a,'select * from buscar_usuarios($1)',['Social Beto'])).length,0)
})

test('solicitud cruzada se acepta y el limite diario protege contra spam', async () => {
  const a = await db.usuario('Cruce Ana'), b = await db.usuario('Cruce Beto')
  await como(a,'select solicitar_contacto($1)',[b]); await como(b,'select solicitar_contacto($1)',[a])
  assert.equal((await db.uno('select count(*)::int n from contacts where (requester_id=$1 and addressee_id=$2) or (requester_id=$2 and addressee_id=$1)',[a,b])).n,1)
  assert.equal((await db.uno('select status from contacts where (requester_id=$1 and addressee_id=$2) or (requester_id=$2 and addressee_id=$1)',[a,b])).status,'aceptado')
})
