import { supabase } from './supabase'

export type MiDisponibilidad = { ofrece: boolean; hasta: string | null }

export const HORAS_BASE = 8

/** Mi estado: si ofrezco servicios y hasta cuando estoy disponible (null = no lo estoy). */
export async function miDisponibilidad(userId: string): Promise<MiDisponibilidad> {
  const { data } = await supabase
    .from('profile_private')
    .select('ofrece_servicios, disponible_hasta')
    .eq('user_id', userId)
    .maybeSingle()
  return { ofrece: !!data?.ofrece_servicios, hasta: (data?.disponible_hasta as string | null) ?? null }
}

/** Disponible las proximas `horas` (1 a 24). Devuelve hasta cuando. */
export async function estoyDisponible(horas = HORAS_BASE): Promise<string> {
  const { data, error } = await supabase.rpc('estoy_disponible', { p_horas: horas })
  if (error) throw error
  return data as string
}

export async function yaNoDisponible(): Promise<void> {
  const { error } = await supabase.rpc('ya_no_disponible')
  if (error) throw error
}
