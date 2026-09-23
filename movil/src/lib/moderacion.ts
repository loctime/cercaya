// Bloquear y denunciar (exigencia de Apple para contenido de usuarios).
import { Alert } from 'react-native'
import { supabase } from './supabase'

export type TipoDenuncia = 'perfil' | 'resena' | 'pedido' | 'mensaje' | 'chat'
export type MotivoDenuncia = 'estafa' | 'spam' | 'ofensivo' | 'falso' | 'otro'

export const MOTIVOS_DENUNCIA: { valor: MotivoDenuncia; texto: string }[] = [
  { valor: 'estafa', texto: 'Estafa o intento de estafa' },
  { valor: 'falso', texto: 'Información falsa o perfil trucho' },
  { valor: 'ofensivo', texto: 'Contenido ofensivo o acoso' },
  { valor: 'spam', texto: 'Spam o publicidad' },
  { valor: 'otro', texto: 'Otro motivo' },
]

export function bloquear(userId: string, nombre: string, despues?: () => void) {
  Alert.alert(
    `Bloquear a ${nombre}`,
    'No va a poder escribirte ni ver tus pedidos, y dejás de verlo en CercaYa. Podés desbloquearlo desde Privacidad.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: async () => {
          const { data } = await supabase.auth.getUser()
          const { error } = await supabase.from('blocks').insert({ blocker_id: data.user!.id, blocked_id: userId })
          // 23505 = ya estaba bloqueado: para el usuario es lo mismo.
          if (error && error.code !== '23505') {
            Alert.alert('No pudimos bloquearlo', 'Probá de nuevo en un rato.')
            return
          }
          despues?.()
        },
      },
    ],
  )
}

export async function denunciar(tipo: TipoDenuncia, id: string, motivo: MotivoDenuncia, detalle: string) {
  const { data } = await supabase.auth.getUser()
  return supabase.from('reports').insert({
    reporter_id: data.user!.id,
    target_type: tipo,
    target_id: id,
    reason: motivo,
    detail: detalle.trim() || null,
  })
}
