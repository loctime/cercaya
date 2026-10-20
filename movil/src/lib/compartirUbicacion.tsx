import * as Location from 'expo-location'
import { AppState, Linking } from 'react-native'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSesion } from './sesion'
import { debeActualizar } from './tiempo'
type Estado = {
  compartiendo: boolean
  cargando: boolean
  activar: () => Promise<'ok' | 'denegado' | 'error'>
  desactivar: () => Promise<void>
  abrirAjustes: () => Promise<void>
}
const C = createContext<Estado>({
  compartiendo: false,
  cargando: true,
  activar: async () => 'error',
  desactivar: async () => {},
  abrirAjustes: () => Linking.openSettings(),
})
export function CompartirUbicacionProvider({ children }: { children: ReactNode }) {
  const { sesion } = useSesion()
  const [compartiendo, set] = useState(false),
    [cargando, setCargando] = useState(true),
    [ultima, setUltima] = useState<string | null>(null)
  useEffect(() => {
    if (!sesion) {
      set(false)
      setCargando(false)
      return
    }
    supabase
      .from('profile_private')
      .select('share_location,location_updated_at')
      .eq('user_id', sesion.user.id)
      .single()
      .then(({ data }) => {
        set(!!data?.share_location)
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
  useEffect(() => {
    if (!compartiendo) return
    const refrescar = () => {
      if (AppState.currentState === 'active' && debeActualizar(ultima, new Date())) enviar().catch(() => {})
    }
    refrescar()
    const i = setInterval(refrescar, 60000)
    return () => clearInterval(i)
  }, [compartiendo, ultima])
  return (
    <C.Provider value={{ compartiendo, cargando, activar, desactivar, abrirAjustes: () => Linking.openSettings() }}>
      {children}
    </C.Provider>
  )
}
export const useCompartirUbicacion = () => useContext(C)
