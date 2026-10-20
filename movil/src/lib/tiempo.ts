export function textoHace(iso: string, ahora = new Date()) {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60000))
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `hace ${horas} h` : 'hace más de un día'
}
export function debeActualizar(ultimaIso: string | null, ahora = new Date(), minutos = 10) {
  return !ultimaIso || ahora.getTime() - new Date(ultimaIso).getTime() >= minutos * 60000
}
