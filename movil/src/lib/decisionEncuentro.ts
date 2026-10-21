// Que hacer despues de cada sync del encuentro en segundo plano. Pura: la
// tarea de ubicacion (tareaEncuentro.ts) solo ejecuta lo que esto decide.
const FINALES = ['terminado', 'rechazado', 'vencido']

export function decidirTrasSync(
  r: { estado: string; llegaron: boolean },
  yaAvisado: boolean,
): { detener: boolean; avisarLlegada: boolean } {
  const detener = FINALES.includes(r.estado)
  return { detener, avisarLlegada: !detener && r.estado === 'activo' && r.llegaron && !yaAvisado }
}
