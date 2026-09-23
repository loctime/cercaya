// Sistema visual de CercaYa (docs/superpowers/specs/2026-09-23-cercaya-v2-pantallas.md).
// Naranja de marca siempre con texto oscuro; botones con texto blanco usan naranjaOscuro.

export const colores = {
  naranja: '#FE6F14',
  naranjaOscuro: '#C2410C',
  naranjaSuave: '#FFF1E5',
  tinta: '#1E1E1E',
  texto2: '#475569',
  fondo: '#FFFFFF',
  grupo: '#F8FAFC',
  borde: '#E2E8F0',
  bordeCampo: '#CBD5E1',
  whatsapp: '#25D366',
  exito: '#16A34A',
  peligro: '#DC2626',
  blanco: '#FFFFFF',
} as const

export const fuentes = {
  titulo: 'Nunito_800ExtraBold',
  tituloSuave: 'Nunito_700Bold',
  texto: 'Inter_400Regular',
  textoMedio: 'Inter_500Medium',
  textoFuerte: 'Inter_600SemiBold',
} as const

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const
export const radio = { s: 8, m: 12, l: 16, full: 999 } as const
