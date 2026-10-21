import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Vibration } from 'react-native'
import { ESTADOS_FINALES, sincronizarEncuentro, type EstadoSync } from './encuentros'
import { decidirTrasSync, lecturaFresca } from './decisionEncuentro'
import { distanciaM, giroFlecha, rumboGrados } from './geo'
import { detenerServicioEncuentro, iniciarServicioEncuentro } from './tareaEncuentro'

const CADA_MS = 5000
const ETIQUETA_PANTALLA = 'cercaya-encuentro'

type Punto = { lat: number; lng: number }

// Estado en vivo de un encuentro: mi posicion, la brujula y el sync cada 5 s.
// Mientras el encuentro esta activo mantiene la pantalla prendida.
export function useEncuentro(id: string, nombreOtro?: string, soySolicitante?: boolean) {
  const [estado, setEstado] = useState<EstadoSync | null>(null)
  const [yo, setYo] = useState<Punto | null>(null)
  const [orientacion, setOrientacion] = useState<number | null>(null)
  const [error, setError] = useState('')
  const ultima = useRef<Punto | null>(null)
  const tomadaEn = useRef<number | null>(null)
  const avisada = useRef(false)
  const sincronizarYa = useRef<() => void>(() => {})

  // Posicion y brujula, solo mientras la pantalla existe.
  useEffect(() => {
    let cancelado = false
    const subs: { remove: () => void }[] = []
    ;(async () => {
      const permiso = await Location.requestForegroundPermissionsAsync()
      if (cancelado) return
      if (permiso.status !== 'granted') {
        setError('Necesitamos tu ubicación para el encuentro. Activala desde Ajustes.')
        return
      }
      const posicion = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 2 },
        (loc) => {
          ultima.current = { lat: loc.coords.latitude, lng: loc.coords.longitude }
          tomadaEn.current = Date.now()
          setYo(ultima.current)
        },
      )
      const rumbo = await Location.watchHeadingAsync((h) =>
        setOrientacion(h.trueHeading >= 0 ? h.trueHeading : h.magHeading),
      )
      if (cancelado) {
        posicion.remove()
        rumbo.remove()
        return
      }
      subs.push(posicion, rumbo)
    })().catch(() => setError('No pudimos leer tu ubicación.'))
    return () => {
      cancelado = true
      subs.forEach((s) => s.remove())
    }
  }, [id])

  // Sync cada 5 s hasta que el encuentro termina.
  useEffect(() => {
    let detenido = false
    async function tick() {
      // Una lectura vieja no se manda como si fuera de ahora (sin GPS: null).
      const p = lecturaFresca(tomadaEn.current, Date.now()) ? ultima.current : null
      try {
        const r = await sincronizarEncuentro(id, p?.lat ?? null, p?.lng ?? null)
        if (detenido) return
        setEstado(r)
        setError((e) => (e.startsWith('Necesitamos') ? e : ''))
        if (ESTADOS_FINALES.includes(r.estado)) clearInterval(intervalo)
      } catch (e: any) {
        // Activo pero sin GPS todavia: no es un error para mostrar.
        if (!detenido && !String(e?.message).includes('Posicion invalida')) setError(e?.message ?? 'Sin conexión')
      }
    }
    const intervalo = setInterval(tick, CADA_MS)
    sincronizarYa.current = tick
    tick()
    return () => {
      detenido = true
      clearInterval(intervalo)
    }
  }, [id])

  const activo = estado?.estado === 'activo'
  useEffect(() => {
    if (!activo) return
    activateKeepAwakeAsync(ETIQUETA_PANTALLA).catch(() => {})
    return () => {
      deactivateKeepAwake(ETIQUETA_PANTALLA).catch(() => {})
    }
  }, [activo])

  // Servicio de ubicacion en segundo plano: quien pide lo arranca al pedir (el
  // servidor descarta las posiciones mientras esta pendiente); quien responde, al
  // aceptar. Se detiene cuando el encuentro termina por cualquier via.
  const fase = estado?.estado
  useEffect(() => {
    if (!fase || !nombreOtro) return
    if (fase === 'activo' || (fase === 'pendiente' && soySolicitante)) {
      iniciarServicioEncuentro(id, nombreOtro)
    } else if (ESTADOS_FINALES.includes(fase)) {
      detenerServicioEncuentro(id)
    }
  }, [id, fase, nombreOtro, soySolicitante])

  // Aviso de llegada: una vez por llegada. Se vuelve a armar recien al separarse
  // mas de 100 m, asi el GPS oscilando alrededor de los 50 m no lo repite.
  const llegaron = !!estado?.llegaron
  useEffect(() => {
    if (!estado) return
    const decision = decidirTrasSync(estado, avisada.current)
    if (decision.avisarLlegada) {
      avisada.current = true
      Vibration.vibrate([0, 500, 200, 500, 200, 500])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
    if (decision.rearmar) avisada.current = false
  }, [estado])

  const otro: Punto | null = useMemo(
    () => (estado?.otro_lat != null && estado.otro_lng != null ? { lat: estado.otro_lat, lng: estado.otro_lng } : null),
    [estado?.otro_lat, estado?.otro_lng],
  )
  const rumbo = yo && otro ? rumboGrados(yo.lat, yo.lng, otro.lat, otro.lng) : null
  const giro = rumbo != null && orientacion != null ? giroFlecha(rumbo, orientacion) : null
  const distancia = yo && otro ? distanciaM(yo.lat, yo.lng, otro.lat, otro.lng) : null

  return {
    estado,
    yo,
    otro,
    rumbo,
    giro,
    distanciaM: distancia,
    llegaron,
    error,
    refrescar: () => sincronizarYa.current(),
  }
}
