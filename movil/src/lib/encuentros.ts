import { supabase } from './supabase'

export type EncuentroResumen = {
  id: string
  estado: 'pendiente' | 'activo'
  soy_solicitante: boolean
  otro_id: string
  otro_nombre: string
  otro_avatar: string | null
  ends_at: string | null
}

export type EstadoEncuentro = 'pendiente' | 'activo' | 'terminado' | 'rechazado' | 'vencido'

export type EstadoSync = {
  estado: EstadoEncuentro
  ends_at: string | null
  otro_lat: number | null
  otro_lng: number | null
  otro_at: string | null
  distancia_m: number | null
  llegaron: boolean
}

export const ESTADOS_FINALES: EstadoEncuentro[] = ['terminado', 'rechazado', 'vencido']

async function rpc<T>(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const pedirEncuentro = (destino: string, minutos = 120) =>
  rpc<string>('pedir_encuentro', { p_destino: destino, p_minutos: minutos })

export const responderEncuentro = (id: string, acepta: boolean) =>
  rpc<null>('responder_encuentro', { p_id: id, p_acepta: acepta })

export const terminarEncuentro = (id: string) => rpc<null>('terminar_encuentro', { p_id: id })

export const misEncuentros = async () => (await rpc<EncuentroResumen[] | null>('mis_encuentros')) ?? []

// Sin posicion (todavia no hay GPS) se manda null: el servidor solo la pide con el encuentro activo.
export async function sincronizarEncuentro(id: string, lat: number | null, lng: number | null) {
  const filas = await rpc<EstadoSync[]>('encuentro_sync', { p_id: id, p_lat: lat, p_lng: lng })
  return filas[0]!
}
