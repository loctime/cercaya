// Lectura y validacion de la planilla de negocios (sin red ni base: se prueba sola).
// Columnas: instagram,nombre,rubro,tipo,lat,lng,telefono,bio

const COLUMNAS = ['instagram', 'nombre', 'rubro', 'tipo', 'lat', 'lng', 'telefono', 'bio']
// Entorno de Ramallo: evita cargar un punto en cualquier lado por un error de tipeo.
const ZONA = { latMin: -33.8, latMax: -33.2, lngMin: -60.2, lngMax: -59.7 }

/** Divide un texto CSV en filas de campos. Admite comillas dobles ("" = comilla). */
function leerFilas(texto) {
  const filas = []
  let fila = []
  let campo = ''
  let entreComillas = false
  const s = texto.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (entreComillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') entreComillas = false
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      filas.push(fila); fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas
}

export function normalizarInstagram(valor) {
  return String(valor ?? '').trim().replace(/^@/, '').toLowerCase()
}

/**
 * @param {string} texto contenido del CSV, con encabezado
 * @param {Set<string>} catalogoIds ids validos de habilidades_catalogo
 * @returns {{ filas: object[], errores: { linea: number, motivo: string }[] }}
 */
export function parsearCsv(texto, catalogoIds) {
  const filas = []
  const errores = []
  const vistos = new Set()
  const todas = leerFilas(texto)
  const cabecera = (todas[0] ?? []).map((c) => c.trim().toLowerCase())
  for (const c of COLUMNAS.slice(0, 6)) {
    if (!cabecera.includes(c)) return { filas, errores: [{ linea: 1, motivo: `Falta la columna "${c}"` }] }
  }

  for (let i = 1; i < todas.length; i++) {
    const linea = i + 1
    const crudo = todas[i]
    if (crudo.every((x) => x.trim() === '')) continue
    const v = Object.fromEntries(cabecera.map((c, j) => [c, (crudo[j] ?? '').trim()]))
    const error = (motivo) => errores.push({ linea, motivo })

    const instagram = normalizarInstagram(v.instagram)
    if (!/^[a-z0-9._]{1,30}$/.test(instagram)) { error('Usuario de Instagram inválido'); continue }
    if (vistos.has(instagram)) { error(`Instagram repetido en la planilla: @${instagram}`); continue }
    if (v.nombre.length < 2 || v.nombre.length > 80) { error('El nombre tiene que tener entre 2 y 80 caracteres'); continue }
    if (!catalogoIds.has(v.rubro)) { error(`Rubro desconocido: "${v.rubro}"`); continue }
    if (v.tipo !== 'local' && v.tipo !== 'a_domicilio') { error('El tipo tiene que ser local o a_domicilio'); continue }
    const lat = Number(v.lat)
    const lng = Number(v.lng)
    if (v.lat === '' || v.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      error('Las coordenadas tienen que ser números'); continue
    }
    if (lat < ZONA.latMin || lat > ZONA.latMax || lng < ZONA.lngMin || lng > ZONA.lngMax) {
      error('Las coordenadas están fuera de la zona de Ramallo'); continue
    }
    if (v.bio && v.bio.length > 300) { error('La bio pasa de 300 caracteres'); continue }

    vistos.add(instagram)
    filas.push({
      instagram, nombre: v.nombre, rubro: v.rubro, tipo: v.tipo, lat, lng,
      telefono: v.telefono || null, bio: v.bio || null,
    })
  }
  return { filas, errores }
}
