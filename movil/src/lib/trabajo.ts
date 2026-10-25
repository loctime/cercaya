// Modo Trabajo: logica pura del buscador de servicios (sin Supabase, para poder
// probarla con node --test). El llamado a la base esta en contactos.ts.

export const RADIO_BASE = 15
export const RADIO_MAX = 50

export type ResultadoServicio = {
  user_id: string
  full_name: string
  avatar_url: string | null
  zona: string | null
  distancia_km: number | string | null
  oficios: string[]
  coincide: string
  es_contacto: boolean
  lat: number
  lng: number
  disponible: boolean
}

/** Hay al menos 2 letras o numeros reales (sin tildes ni simbolos). */
export function consultaValida(texto: string): boolean {
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return limpio.length >= 2
}

/**
 * Cada llamada a la funcion devuelta abre una consulta nueva y devuelve su
 * `vigente()`: true solo mientras no se haya abierto una mas nueva. Sirve para
 * descartar la respuesta lenta de una busqueda vieja.
 */
export function nuevaSecuencia(): () => () => boolean {
  let actual = 0
  return () => {
    const mia = ++actual
    return () => mia === actual
  }
}

/** true si `hasta` es una fecha valida posterior a `ahora`. */
export function disponibleAhora(hasta: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!hasta) return false
  const t = new Date(hasta).getTime()
  return Number.isFinite(t) && t > ahora.getTime()
}

/** "hasta las 18:30" en hora local del celular. */
export function textoDisponibleHasta(hasta: string): string {
  const d = new Date(hasta)
  return `hasta las ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
