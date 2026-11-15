import { supabase } from './supabase'

export * from './negociosTexto'

export type Negocio = {
  id: string
  nombre: string
  rubro: string
  bio: string | null
  instagram_usuario: string
  tipo: 'local' | 'a_domicilio'
  telefono: string | null
  estado: 'sin_reclamar' | 'reclamado'
  distancia_km: number | string | null
  lat: number
  lng: number
  es_mio: boolean
}

export type MiNegocio = {
  id: string
  nombre: string
  bio: string | null
  telefono: string | null
  tipo: 'local' | 'a_domicilio'
  lat: number
  lng: number
  estado: 'sin_reclamar' | 'reclamado' | 'oculto'
  motivo_oculto: 'baja' | 'dueno' | 'admin' | 'cuenta' | null
}

export type ReclamoAdmin = {
  id: string
  negocio_id: string
  negocio_nombre: string
  instagram_usuario: string
  user_id: string
  user_nombre: string
  email: string
  codigo: string
  created_at: string
  vence_at: string
}

export type BajaAdmin = {
  id: string
  negocio_id: string
  negocio_nombre: string
  instagram_usuario: string
  user_nombre: string | null
  motivo: string | null
  created_at: string
}

async function rpc<T>(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const buscarNegocios = async (texto: string, radioKm = 15) =>
  ((await rpc<Negocio[] | null>('negocios_cerca', { p_texto: texto, p_radio_km: radioKm })) ?? [])

export const reclamarNegocio = (id: string, email: string) =>
  rpc<string>('reclamar_negocio', { p_negocio: id, p_email: email })

export async function miReclamo(id: string) {
  const r = await rpc<{ codigo: string; vence_at: string }[] | null>('mi_reclamo', { p_negocio: id })
  return r?.[0] ?? null
}

export const pedirBajaNegocio = async (id: string, motivo?: string) => {
  await rpc('pedir_baja_negocio', { p_negocio: id, p_motivo: motivo ?? null })
}

export const misNegocios = async () => (await rpc<MiNegocio[] | null>('mis_negocios')) ?? []

export const editarMiNegocio = async (
  id: string,
  cambios: { nombre?: string; bio?: string; telefono?: string; tipo?: 'local' | 'a_domicilio'; lat?: number; lng?: number },
) => {
  await rpc('editar_mi_negocio', {
    p_negocio: id,
    p_nombre: cambios.nombre ?? null,
    p_bio: cambios.bio ?? null,
    p_telefono: cambios.telefono ?? null,
    p_tipo: cambios.tipo ?? null,
    p_lat: cambios.lat ?? null,
    p_lng: cambios.lng ?? null,
  })
}

export const ocultarMiNegocio = async (id: string, oculto: boolean) => {
  await rpc('ocultar_mi_negocio', { p_negocio: id, p_oculto: oculto })
}

// Administracion
export const adminReclamos = async () => (await rpc<ReclamoAdmin[] | null>('admin_reclamos_pendientes')) ?? []
export const adminResolverReclamo = async (id: string, aprueba: boolean) => {
  await rpc('admin_resolver_reclamo', { p_reclamo: id, p_aprueba: aprueba })
}
export const adminBajas = async (estado: 'pendiente' | 'confirmada') =>
  (await rpc<BajaAdmin[] | null>('admin_bajas', { p_estado: estado })) ?? []
export const adminResolverBaja = async (id: string, confirma: boolean) => {
  await rpc('admin_resolver_baja', { p_baja: id, p_confirma: confirma })
}

export type NegocioAdmin = {
  id: string
  nombre: string
  instagram_usuario: string
  estado: 'sin_reclamar' | 'reclamado' | 'oculto'
  motivo_oculto: 'baja' | 'dueno' | 'admin' | 'cuenta' | null
}
export const adminBuscarNegocios = async (texto: string) =>
  (await rpc<NegocioAdmin[] | null>('admin_negocios', { p_texto: texto })) ?? []
export const adminOcultarNegocio = async (id: string, motivo?: string) => {
  await rpc('admin_ocultar_negocio', { p_negocio: id, p_motivo: motivo ?? null })
}
