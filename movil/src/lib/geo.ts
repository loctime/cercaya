// Calculos de distancia y direccion para el encuentro. Mismas formulas que
// festival-compass (haversine y rumbo inicial), con textos en criollo.
const RADIO_TIERRA_M = 6371000

const aRadianes = (grados: number) => (grados * Math.PI) / 180
const aGrados = (radianes: number) => (radianes * 180) / Math.PI

export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = aRadianes(lat2 - lat1)
  const dLng = aRadianes(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLng / 2) ** 2
  return RADIO_TIERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 0 = norte, sentido horario, en [0, 360).
export function rumboGrados(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = aRadianes(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(aRadianes(lat2))
  const x =
    Math.cos(aRadianes(lat1)) * Math.sin(aRadianes(lat2)) -
    Math.sin(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.cos(dLng)
  return (aGrados(Math.atan2(y, x)) + 360) % 360
}

// Cuanto hay que girar la flecha en pantalla: rumbo hacia el otro menos hacia donde mira el celular.
export function giroFlecha(rumbo: number, orientacion: number): number {
  return (((rumbo - orientacion) % 360) + 360) % 360
}

export function textoDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`
  const km = metros / 1000
  const texto = Number.isInteger(Math.round(km * 10) / 10) ? String(Math.round(km)) : (Math.round(km * 10) / 10).toFixed(1)
  return `${texto.replace('.', ',')} km`
}

const CARDINALES = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']

export function textoCardinal(rumbo: number): string {
  return CARDINALES[Math.round((((rumbo % 360) + 360) % 360) / 45) % 8]!
}
