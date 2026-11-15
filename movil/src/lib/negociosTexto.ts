// Negocios: textos y enlaces (logica pura, sin Supabase, se prueba con node --test).
import { numeroWhatsApp } from './telefono.ts'

/** Cuenta oficial de Instagram a la que llegan los codigos de reclamo. */
export const INSTAGRAM_OFICIAL = 'cercaya'

export const urlInstagram = (usuario: string) => `https://instagram.com/${usuario}`
export const urlInstagramOficial = () => urlInstagram(INSTAGRAM_OFICIAL)

/** Lo que el dueño manda por mensaje directo a @cercaya. */
export const textoMensajeCodigo = (codigo: string) =>
  `Hola! Quiero reclamar mi negocio en CercaYa. Mi código es ${codigo}`

/** Dias que faltan hasta `vence`, redondeado para arriba; 0 si ya paso o no es fecha. */
export function diasRestantes(vence: string, ahora: Date = new Date()): number {
  const t = new Date(vence).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.ceil((t - ahora.getTime()) / 86_400_000))
}

/** Enlace de WhatsApp para un telefono cargado a mano, o null si no es un celular valido. */
export function urlWhatsApp(telefono: string | null | undefined): string | null {
  const n = telefono ? numeroWhatsApp(telefono) : null
  return n ? `https://wa.me/${n}` : null
}
