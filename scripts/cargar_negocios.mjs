// Carga negocios desde una planilla CSV a la base de produccion.
//   node scripts/cargar_negocios.mjs planilla.csv            -> solo valida (no escribe)
//   node scripts/cargar_negocios.mjs planilla.csv --aplicar  -> carga las filas validas
// Necesita SUPABASE_ACCESS_TOKEN en el entorno (no se guarda en el repo).
import { readFileSync } from 'node:fs'
import { parsearCsv } from './negocios-csv.mjs'

const PROYECTO = 'jmgoquaxvmzqjkrnfcwo'
const [archivo, ...flags] = process.argv.slice(2)
const aplicar = flags.includes('--aplicar')
if (!archivo) {
  console.error('Uso: node scripts/cargar_negocios.mjs <planilla.csv> [--aplicar]')
  process.exit(1)
}
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en el entorno')
  process.exit(1)
}

async function consulta(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const cuerpo = await r.text()
  if (!r.ok) throw new Error(cuerpo)
  return JSON.parse(cuerpo)
}
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

const catalogo = new Set((await consulta('select id from habilidades_catalogo')).map((x) => x.id))
const { filas, errores } = parsearCsv(readFileSync(archivo, 'utf8'), catalogo)
console.log(`${filas.length} filas válidas, ${errores.length} con errores`)
for (const e of errores) console.log(`  línea ${e.linea}: ${e.motivo}`)

if (!aplicar) {
  console.log('Modo prueba: no se escribió nada. Agregá --aplicar para cargar.')
  process.exit(errores.length ? 2 : 0)
}

let cargados = 0
let existentes = 0
for (const f of filas) {
  try {
    await consulta(
      `select cargar_negocio(${lit(f.nombre)}, ${lit(f.rubro)}, ${lit(f.instagram)}, ${lit(f.tipo)}, ` +
        `${f.lat}, ${f.lng}, ${lit(f.telefono)}, ${lit(f.bio)})`,
    )
    cargados++
  } catch (e) {
    if (/Ya existe/.test(e.message)) { existentes++; console.log(`  @${f.instagram}: ya estaba`) }
    else console.log(`  @${f.instagram}: ERROR ${e.message}`)
  }
}
console.log(`Cargados: ${cargados}. Ya existían: ${existentes}.`)
