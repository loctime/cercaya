import * as Location from 'expo-location'
import { AppState, Linking } from 'react-native'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSesion } from './sesion'
import { debeActualizar } from './tiempo'
type Estado = {
  compartiendo: boolean
  publico: boolean
  cargando: boolean
  activar: () => Promise<'ok' | 'denegado' | 'error'>
  desactivar: () => Promise<void>
  activarPublico: () => Promise<'ok' | 'denegado' | 'error'>
  desactivarPublico: () => Promise<void>
  abrirAjustes: () => Promise<void>
}
const C = createContext<Estado>({
  compartiendo: false,
  publico: false,
  cargando: true,
  activar: async () => 'error',
  desactivar: async () => {},
  activarPublico: async () => 'error',
  desactivarPublico: async () => {},
  abrirAjustes: () => Linking.openSettings(),
})
export function CompartirUbicacionProvider({ children }: { children: ReactNode }) {
  const { sesion } = useSesion()
  const [compartiendo, set] = useState(false),
    [publico, setPublico] = useState(false),
    [cargando, setCargando] = useState(true),
    [ultima, setUltima] = useState<string | null>(null)
  useEffect(() => {
    if (!sesion) {
      set(false)
      setPublico(false)
      setCargando(false)
      return
    }
    supabase
      .from('profile_private')
      .select('share_location,es_publico,location_updated_at')
      .eq('user_id', sesion.user.id)
      .single()
      .then(({ data }) => {
        set(!!data?.share_location)
        setPublico(!!data?.es_publico)
        setUltima(data?.location_updated_at ?? null)
        setCargando(false)
      })
  }, [sesion?.user.id])
  async function enviar() {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const { error } = await supabase.rpc('set_mi_ubicacion', { p_lat: p.coords.latitude, p_lng: p.coords.longitude })
    if (error) throw error
    const ahora = new Date().toISOString()
    setUltima(ahora)
  }
  async function activar() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return 'denegado'
      await enviar()
      const { error } = await supabase
        .from('profile_private')
        .update({ share_location: true })
        .eq('user_id', sesion?.user.id)
      if (error) throw error
      set(true)
      return 'ok'
    } catch {
      return 'error'
    }
  }
  async function desactivar() {
    await supabase.from('profile_private').update({ share_location: false }).eq('user_id', sesion?.user.id)
    set(false)
  }
  // Activar cualquiera de los dos pide el permiso y manda la posicion una vez.
  async function encender(columna: 'share_location' | 'es_publico', avisar: (v: boolean) => void) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return 'denegado' as const
      await enviar()
      const { error } = await supabase
        .from('profile_private')
        .update({ [columna]: true })
        .eq('user_id', sesion?.user.id)
      if (error) throw error
      avisar(true)
      return 'ok' as const
    } catch {
      return 'error' as const
    }
  }
  const activarPublico = () => encender('es_publico', setPublico)
  async function desactivarPublico() {
    await supabase.from('profile_private').update({ es_publico: false }).eq('user_id', sesion?.user.id)
    setPublico(false)
  }
  useEffect(() => {
    if (!compartiendo && !publico) return
    const refrescar = () => {
      if (AppState.currentState === 'active' && debeActualizar(ultima, new Date())) enviar().catch(() => {})
    }
    refrescar()
    const i = setInterval(refrescar, 60000)
    return () => clearInterval(i)
  }, [compartiendo, publico, ultima])
  return (
    <C.Provider
      value={{
        compartiendo,
        publico,
        cargando,
        activar,
        desactivar,
        activarPublico,
        desactivarPublico,
        abrirAjustes: () => Linking.openSettings(),
      }}
    >
      {children}
    </C.Provider>
  )
}
export const useCompartirUbicacion = () => useContext(C)
