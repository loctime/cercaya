// Pedidos: tipos, textos de estado y fotos (bucket privado "pedidos").
import { elegirImagenes, subirImagen, type FotoLocal } from './imagenes'
import { supabase } from './supabase'

export type { FotoLocal }

export type EstadoPedido = 'abierto' | 'en_conversacion' | 'asignado' | 'realizado' | 'cerrado' | 'cancelado'
export type Urgencia = 'hoy' | 'semana' | 'a_coordinar'

export type Pedido = {
  id: string
  client_id: string
  category_id: number
  title: string
  description: string
  urgency: Urgencia
  preferred_date: string | null
  zone_label: string | null
  status: EstadoPedido
  assigned_provider_id: string | null
  assigned_at: string | null
  provider_done_at: string | null
  client_confirmed_at: string | null
  closed_at: string | null
  created_at: string
}

export const CAMPOS_PEDIDO =
  'id, client_id, category_id, title, description, urgency, preferred_date, zone_label, status, assigned_provider_id, assigned_at, provider_done_at, client_confirmed_at, closed_at, created_at'

export const ESTADOS: Record<EstadoPedido, { texto: string; fondo: string; tinta: string }> = {
  abierto: { texto: 'Buscando prestadores', fondo: '#FFF1E5', tinta: '#9A3412' },
  en_conversacion: { texto: 'En contacto', fondo: '#EFF6FF', tinta: '#1D4ED8' },
  asignado: { texto: 'Trabajo acordado', fondo: '#F5F3FF', tinta: '#6D28D9' },
  realizado: { texto: 'Trabajo terminado', fondo: '#ECFDF5', tinta: '#047857' },
  cerrado: { texto: 'Finalizado', fondo: '#F1F5F9', tinta: '#334155' },
  cancelado: { texto: 'Cancelado', fondo: '#FEF2F2', tinta: '#B91C1C' },
}

export const URGENCIAS: { valor: Urgencia; texto: string }[] = [
  { valor: 'hoy', texto: 'Urgente, hoy' },
  { valor: 'semana', texto: 'Esta semana' },
  { valor: 'a_coordinar', texto: 'A coordinar' },
]

export const textoUrgencia = (u: Urgencia) => URGENCIAS.find((x) => x.valor === u)?.texto ?? u

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------
export const elegirFotos = (max: number) => elegirImagenes(max)

// Sube las fotos a pedidos/<mi id>/<pedido>/n.jpg y las registra.
export async function subirFotosPedido(jobId: string, userId: string, fotos: FotoLocal[]) {
  for (const [i, f] of fotos.entries()) {
    const ruta = await subirImagen('pedidos', `${userId}/${jobId}`, f)
    const { error: e2 } = await supabase.from('job_photos').insert({ job_id: jobId, storage_path: ruta, position: i })
    if (e2) throw e2
  }
}

// El bucket es privado: URLs firmadas por una hora.
export async function urlsFotosPedido(jobId: string): Promise<string[]> {
  const { data } = await supabase.from('job_photos').select('storage_path').eq('job_id', jobId).order('position')
  if (!data?.length) return []
  const { data: firmadas } = await supabase.storage.from('pedidos').createSignedUrls(
    data.map((f) => f.storage_path),
    3600,
  )
  return (firmadas ?? []).map((f) => f.signedUrl).filter(Boolean) as string[]
}

// Proximos 14 dias para elegir fecha preferida sin calendario nativo.
export function proximosDias(n = 14) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const etiqueta = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dias[d.getDay()]
    return { iso, etiqueta, dia: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
  })
}
