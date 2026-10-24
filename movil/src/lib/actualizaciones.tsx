// Actualizaciones de la app.
//  1) Codigo (JS): al abrir y cada vez que vuelve a primer plano pregunta a EAS
//     Update; si hay algo nuevo lo baja y reinicia la app sola (el "Ctrl+F5").
//  2) APK viejo: el runtime del APK no recibe updates de uno mas nuevo. El
//     servidor publica una version minima (version_app()) y, si esta app es mas
//     vieja, se bloquea con un aviso para descargar la nueva.
import * as Linking from 'expo-linking'
import * as Updates from 'expo-updates'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native'
import { Boton, Texto, Titulo } from '../components/ui'
import { colores, espacio } from '../theme'
import { supabase } from './supabase'
import { versionObsoleta } from './version'

// Con el runtime "appVersion", runtimeVersion es la version del APK instalado.
// En Expo Go o en desarrollo no hay runtime: nada que comprobar.
export const versionInstalada = Updates.runtimeVersion ?? '0.0.0'
const activo = Updates.isEnabled && !__DEV__
const MIN_ENTRE_CHEQUEOS_MS = 60_000

type Resultado = 'sin_novedades' | 'actualizando' | 'error' | 'no_disponible'

type Ctx = {
  buscar: () => Promise<Resultado>
  buscando: boolean
}
const Contexto = createContext<Ctx>({ buscar: async () => 'no_disponible', buscando: false })
export const useActualizaciones = () => useContext(Contexto)

type Minima = { minima: string | null; url_descarga: string | null; mensaje: string | null }

export function ActualizacionesProvider({ children }: { children: ReactNode }) {
  const [buscando, setBuscando] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [minima, setMinima] = useState<Minima | null>(null)
  const ultimo = useRef(0)
  const enCurso = useRef(false)

  const buscar = useCallback(async (): Promise<Resultado> => {
    if (!activo) return 'no_disponible'
    if (enCurso.current) return 'sin_novedades'
    enCurso.current = true
    setBuscando(true)
    try {
      const r = await Updates.checkForUpdateAsync()
      if (!r.isAvailable) return 'sin_novedades'
      setBajando(true)
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
      return 'actualizando'
    } catch {
      setBajando(false)
      return 'error'
    } finally {
      enCurso.current = false
      setBuscando(false)
    }
  }, [])

  const revisar = useCallback(async () => {
    if (Date.now() - ultimo.current < MIN_ENTRE_CHEQUEOS_MS) return
    ultimo.current = Date.now()
    const { data } = await supabase.rpc('version_app')
    if (data?.[0]) setMinima(data[0] as Minima)
    await buscar()
  }, [buscar])

  useEffect(() => {
    if (!activo) return
    revisar()
    const sub = AppState.addEventListener('change', (e) => e === 'active' && revisar())
    return () => sub.remove()
  }, [revisar])

  if (activo && minima && versionObsoleta(versionInstalada, minima.minima)) {
    return <AppObsoleta datos={minima} />
  }

  return (
    <Contexto.Provider value={{ buscar, buscando }}>
      {children}
      {bajando && (
        <View style={estilos.velo} pointerEvents="auto">
          <ActivityIndicator color={colores.naranja} size="large" />
          <Texto fuerte>Actualizando CercaYa…</Texto>
        </View>
      )}
    </Contexto.Provider>
  )
}

function AppObsoleta({ datos }: { datos: Minima }) {
  return (
    <View style={estilos.pantalla}>
      <Titulo nivel={2} style={{ textAlign: 'center' }}>
        Hay una versión nueva
      </Titulo>
      <Texto suave style={{ textAlign: 'center' }}>
        {datos.mensaje}
      </Texto>
      <Texto suave style={{ textAlign: 'center', fontSize: 14 }}>
        Tu versión: {versionInstalada} · Necesaria: {datos.minima}
      </Texto>
      {datos.url_descarga && <Boton onPress={() => Linking.openURL(datos.url_descarga!)}>Descargar</Boton>}
    </View>
  )
}

const estilos = StyleSheet.create({
  velo: {
    ...StyleSheet.absoluteFill as object,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.m,
  },
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.l,
    padding: espacio.xl,
  },
})
