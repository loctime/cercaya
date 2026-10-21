// Decisiones puras del encuentro. La tarea de ubicacion (tareaEncuentro.ts) y el
// hook (useEncuentro.ts) solo ejecutan lo que se decide aca.
const FINALES = ['terminado', 'rechazado', 'vencido']

// A mas de esto el aviso de llegada se vuelve a armar: asi el GPS oscilando
// alrededor de los 50 m no hace sonar la notificacion una y otra vez.
const DISTANCIA_REARME_M = 100

export function decidirTrasSync(
  r: { estado: string; llegaron: boolean; distancia_m?: number | null },
  yaAvisado: boolean,
): { detener: boolean; avisarLlegada: boolean; rearmar: boolean } {
  const detener = FINALES.includes(r.estado)
  return {
    detener,
    avisarLlegada: !detener && r.estado === 'activo' && r.llegaron && !yaAvisado,
    rearmar: !detener && r.distancia_m != null && r.distancia_m > DISTANCIA_REARME_M,
  }
}

// Errores que significan "este celular ya no tiene nada que hacer en este
// encuentro" (cerro sesion, ya no es suyo): el servicio se apaga. Un corte de
// red no entra aca: se reintenta en el proximo punto.
export function errorTerminal(mensaje: string): boolean {
  return /No sos parte|permission denied|JWT|Necesitas iniciar sesion/i.test(mensaje)
}

// Una lectura de GPS vieja no se manda como si fuera de ahora: el otro vería un
// punto viejo como en vivo y nunca el "sin señal".
export function lecturaFresca(tomadaEn: number | null, ahora: number, maxMs = 30_000): boolean {
  return tomadaEn != null && ahora - tomadaEn <= maxMs
}
