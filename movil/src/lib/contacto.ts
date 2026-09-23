// Contactar a un prestador respetando su privacidad:
// - invitado -> login
// - el servidor decide si da el telefono (visible, cerca, sin bloqueo)
// - si lo da: WhatsApp directo; si no: chat interno de CercaYa.
import { router } from 'expo-router'
import { Alert, Linking } from 'react-native'
import { supabase } from './supabase'
import { numeroWhatsApp } from './telefono'

export type ResultadoContacto =
  | { ok: true; telefono: string }
  | { ok: false; motivo: 'sin_sesion' | 'bloqueado' | 'oculto' | 'sin_telefono' | 'sin_ubicacion' | 'lejos' | 'limite' }

export async function consultarContacto(userId: string): Promise<ResultadoContacto> {
  const { data, error } = await supabase.rpc('obtener_contacto', { p_user: userId })
  if (error || !data) return { ok: false, motivo: 'oculto' }
  return data as ResultadoContacto
}

export function mensajeInicial(nombre: string, rubro?: string) {
  const primerNombre = nombre.split(' ')[0]
  return `Hola ${primerNombre}, te contacto desde CercaYa para consultarte por un trabajo${rubro ? ` de ${rubro.toLowerCase()}` : ''}.`
}

export async function abrirWhatsApp(userId: string, telefono: string, texto: string) {
  const numero = numeroWhatsApp(telefono)
  if (!numero) {
    Alert.alert('Número inválido', 'Este prestador cargó mal su número. Escribile por el chat de CercaYa.')
    return false
  }
  supabase.rpc('registrar_evento', { p_target: userId, p_kind: 'whatsapp' })
  const t = encodeURIComponent(texto)
  // Abre la app de WhatsApp directo; si no esta instalada, cae a wa.me.
  try {
    await Linking.openURL(`whatsapp://send?phone=${numero}&text=${t}`)
  } catch {
    await Linking.openURL(`https://wa.me/${numero}?text=${t}`)
  }
  return true
}

export async function abrirChat(userId: string, jobId?: string) {
  const { data, error } = await supabase.rpc('abrir_chat', { p_other: userId, p_job: jobId ?? null })
  if (error || !data) {
    Alert.alert('No pudimos abrir el chat', error?.message ?? 'Probá de nuevo en un rato.')
    return
  }
  router.push({ pathname: '/chat/[id]', params: { id: data as string } })
}

// Accion completa del boton "Contactar".
export async function contactar(opts: { userId: string; nombre: string; rubro?: string; conSesion: boolean }) {
  if (!opts.conSesion) {
    router.push('/login')
    return
  }
  const r = await consultarContacto(opts.userId)
  if (r.ok) {
    await abrirWhatsApp(opts.userId, r.telefono, mensajeInicial(opts.nombre, opts.rubro))
  } else {
    await abrirChat(opts.userId)
  }
}
