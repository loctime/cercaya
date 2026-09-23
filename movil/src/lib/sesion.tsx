import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type Perfil = {
  id: string
  full_name: string
  avatar_url: string | null
  zone_label: string | null
  is_admin: boolean
  created_at: string
}

type Estado = {
  cargando: boolean
  sesion: Session | null
  perfil: Perfil | null
  recargarPerfil: () => Promise<void>
}

const SesionContext = createContext<Estado>({
  cargando: true,
  sesion: null,
  perfil: null,
  recargarPerfil: async () => {},
})

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  async function cargarPerfil(userId: string | undefined) {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, zone_label, is_admin, created_at')
      .eq('id', userId)
      .single()
    setPerfil(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session)
      await cargarPerfil(data.session?.user.id)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSesion(nueva)
      // No usar await dentro del callback de onAuthStateChange (bloquea el cliente).
      setTimeout(() => cargarPerfil(nueva?.user.id), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <SesionContext.Provider
      value={{ cargando, sesion, perfil, recargarPerfil: () => cargarPerfil(sesion?.user.id) }}
    >
      {children}
    </SesionContext.Provider>
  )
}

export const useSesion = () => useContext(SesionContext)
