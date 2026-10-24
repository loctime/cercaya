// Comparacion de versiones "1.2.0". Sin dependencias para poder probarla con node --test.

function partes(v: string): number[] {
  return v.split('.').map((x) => parseInt(x, 10) || 0)
}

/** Negativo si a < b, 0 si son iguales, positivo si a > b. */
export function compararVersiones(a: string, b: string): number {
  const pa = partes(a)
  const pb = partes(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** La app instalada es mas vieja que la minima exigida por el servidor. */
export function versionObsoleta(instalada: string, minima: string | null | undefined): boolean {
  return !!minima && compararVersiones(instalada, minima) < 0
}
