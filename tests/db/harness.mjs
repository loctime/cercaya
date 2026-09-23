// Base de pruebas en memoria (PGlite) con las mismas migraciones que
// produccion. Mismo patron que Regalapp.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'supabase', 'migrations')

export async function crearDb() {
  const pg = new PGlite()
  await pg.waitReady
  for (const archivo of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await pg.exec(readFileSync(join(DIR, archivo), 'utf8'))
    } catch (e) {
      throw new Error(`Fallo la migracion ${archivo}: ${e.message}`)
    }
  }

  const db = {
    pg,
    async sql(q, params = []) {
      return (await pg.query(q, params)).rows
    },
    async uno(q, params = []) {
      return (await db.sql(q, params))[0]
    },
    // Corre fn como un usuario (authenticated) o invitado (anon), con RLS.
    async como(userId, fn) {
      await pg.exec('begin')
      try {
        await pg.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
        await pg.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
        const r = await fn(db)
        await pg.exec('commit')
        return r
      } catch (e) {
        await pg.exec('rollback')
        throw e
      }
    },
    // Alta de usuario como lo haria Supabase Auth. Devuelve el id.
    async usuario(nombre, { phone = null, lat = null, lng = null } = {}) {
      const { id } = await db.uno(
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
        [`${nombre.toLowerCase().replace(/\s+/g, '.')}@test.com`, { full_name: nombre, phone }],
      )
      if (lat != null) {
        await db.sql(`update profile_private set lat = $2, lng = $3 where user_id = $1`, [id, lat, lng])
      }
      return id
    },
    // Prestador aprobado con rubros.
    async prestador(nombre, { categorias = [4], lat, lng, showPhone = false, phone = '3407111111', radio = 15 } = {}) {
      const id = await db.usuario(nombre, { phone, lat, lng })
      await db.sql(`update profile_private set show_phone = $2 where user_id = $1`, [id, showPhone])
      await db.sql(
        `insert into provider_profiles (user_id, coverage_radius_km, status) values ($1, $2, 'aprobado')`,
        [id, radio],
      )
      for (const c of categorias) {
        await db.sql(`insert into provider_services (user_id, category_id) values ($1, $2)`, [id, c])
      }
      return id
    },
    cerrar: () => pg.close(),
  }
  return db
}

// Puntos de prueba
export const RAMALLO = { lat: -33.4833, lng: -60.0167 }
export const CERCA = { lat: -33.49, lng: -60.02 }         // ~0,8 km
export const VILLA = { lat: -33.505, lng: -60.065 }        // ~5 km
export const ROSARIO = { lat: -32.95, lng: -60.65 }        // ~80 km
