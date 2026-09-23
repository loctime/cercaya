// Origen de busqueda del usuario: GPS o una localidad elegida a mano.
// Se guarda en el telefono (sirve tambien para invitados) y, si hay
// sesion, se manda al servidor con set_mi_ubicacion. La ubicacion
// exacta nunca se muestra a otras personas: el servidor solo devuelve
// distancias redondeadas.
import * as Location from 'expo-location'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSesion } from './sesion'
import { supabase } from './supabase'

export type Zona = { id: number; name: string; lat: number; lng: number }

export type Origen = {
  lat: number
  lng: number
  etiqueta: string
  fuente: 'gps' | 'manual'
}

const CLAVE = 'cercaya.origen'
const RAMALLO: Origen = { lat: -33.4833, lng: -60.0167, etiqueta: 'Ramallo', fuente: 'manual' }

type Estado = {
  origen: Origen
  elegirZona: (z: Zona) => Promise<void>
  usarGps: () => Promise<'ok' | 'denegado' | 'error'>
}

const UbicacionContext = createContext<Estado>({
  origen: RAMALLO,
  elegirZona: async () => {},
  usarGps: async () => 'error',
})

function leerGuardado(): Origen {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? (JSON.parse(crudo) as Origen) : RAMALLO
  } catch {
    return RAMALLO
  }
}

export function UbicacionProvider({ children }: { children: ReactNode }) {
  const { sesion } = useSesion()
  const [origen, setOrigen] = useState<Origen>(leerGuardado)

  // Al iniciar sesion, el servidor se entera de la ubicacion que ya teniamos.
  useEffect(() => {
    if (sesion) supabase.rpc('set_mi_ubicacion', { p_lat: origen.lat, p_lng: origen.lng })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion?.user.id])

  async function guardar(nuevo: Origen) {
    setOrigen(nuevo)
    localStorage.setItem(CLAVE, JSON.stringify(nuevo))
    if (sesion) await supabase.rpc('set_mi_ubicacion', { p_lat: nuevo.lat, p_lng: nuevo.lng })
  }

  async function elegirZona(z: Zona) {
    await guardar({ lat: z.lat, lng: z.lng, etiqueta: z.name, fuente: 'manual' })
  }

  async function usarGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return 'denegado' as const
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { lat, lng } = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      // Etiqueta = la localidad oficial mas cercana (las mismas 6 de la base).
      const { data } = await supabase.from('zones').select('id, name, lat, lng')
      const cercana = (data ?? [])
        .map((z) => ({ z, d: (z.lat - lat) ** 2 + (z.lng - lng) ** 2 }))
        .sort((a, b) => a.d - b.d)[0]?.z
      await guardar({ lat, lng, etiqueta: cercana?.name ?? 'Mi ubicación', fuente: 'gps' })
      return 'ok' as const
    } catch {
      return 'error' as const
    }
  }

  return <UbicacionContext.Provider value={{ origen, elegirZona, usarGps }}>{children}</UbicacionContext.Provider>
}

export const useUbicacion = () => useContext(UbicacionContext)
