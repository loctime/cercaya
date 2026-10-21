import { supabase } from './supabase'
export type ContactoMapa = {
  user_id: string
  full_name: string
  avatar_url: string | null
  lat: number
  lng: number
  actualizada_at: string
  desactualizada: boolean
}
export type Contacto = {
  contact_id: string
  user_id: string
  full_name: string
  avatar_url: string | null
  estado: 'aceptado' | 'recibida' | 'enviada'
}
export type ResultadoBusqueda = {
  user_id: string
  full_name: string
  avatar_url: string | null
  estado: Contacto['estado'] | null
}
async function rpc<T>(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return (data ?? []) as T
}
export const cargarMapa = () => rpc<ContactoMapa[]>('mapa_contactos')
export const cargarContactos = () => rpc<Contacto[]>('mis_contactos')
export const buscar = (texto: string) => rpc<ResultadoBusqueda[]>('buscar_usuarios', { p_texto: texto })
export const solicitar = (id: string) => rpc('solicitar_contacto', { p_destino: id })
export const responder = (id: string, acepta: boolean) =>
  rpc('responder_contacto', { p_solicitud: id, p_acepta: acepta })
export const quitar = (id: string) => rpc('quitar_contacto', { p_otro: id })
export type PersonaCerca = {
  user_id: string
  full_name: string
  avatar_url: string | null
  zona: string | null
  distancia_km: number | string | null
  oficios: string[]
  estado: 'enviada' | 'recibida' | null
  lat: number
  lng: number
}
export const personasCerca = (radioKm = 15) => rpc<PersonaCerca[]>('personas_cerca', { p_radio_km: radioKm })
