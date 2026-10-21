// Servicio de ubicacion del encuentro: con la app en segundo plano o la
// pantalla apagada sigue mandando mi posicion a encuentro_sync. Android
// muestra un aviso fijo mientras corre. Se importa por efecto secundario
// desde _layout.tsx: TaskManager.defineTask tiene que ejecutarse en el alcance
// global del bundle, tambien cuando Android despierta la app en segundo plano.
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { decidirTrasSync, errorTerminal } from './decisionEncuentro'
import { avisoLocal } from './push'
import { supabase } from './supabase'

const TAREA = 'cercaya-encuentro'
const CLAVE_ENCUENTRO = 'cercaya.encuentro_activo'
const CLAVE_NOMBRE = 'cercaya.encuentro_nombre'
const CLAVE_AVISADO = 'cercaya.encuentro_avisado'

function limpiarClaves() {
  localStorage.removeItem(CLAVE_ENCUENTRO)
  localStorage.removeItem(CLAVE_NOMBRE)
  localStorage.removeItem(CLAVE_AVISADO)
}

// Con `soloSiEs`, no toca el servicio si hoy sigue a otro encuentro.
export async function detenerServicioEncuentro(soloSiEs?: string) {
  const actual = localStorage.getItem(CLAVE_ENCUENTRO)
  if (soloSiEs && actual && actual !== soloSiEs) return
  limpiarClaves()
  if (await Location.hasStartedLocationUpdatesAsync(TAREA).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TAREA).catch(() => {})
  }
}

export async function servicioActivo() {
  return Location.hasStartedLocationUpdatesAsync(TAREA).catch(() => false)
}

// Devuelve false si Android o el usuario no lo permiten (la pantalla sigue
// funcionando con la app abierta).
export async function iniciarServicioEncuentro(encuentroId: string, nombreOtro: string) {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync()
    if (permiso.status !== 'granted') return false
    if (localStorage.getItem(CLAVE_ENCUENTRO) !== encuentroId) {
      localStorage.setItem(CLAVE_ENCUENTRO, encuentroId)
      localStorage.setItem(CLAVE_NOMBRE, nombreOtro)
      localStorage.removeItem(CLAVE_AVISADO)
    }
    if (await servicioActivo()) return true
    await Location.startLocationUpdatesAsync(TAREA, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: 'Compartiendo ubicación',
        notificationBody: `Con ${nombreOtro.split(' ')[0]}`,
        notificationColor: '#FE6F14',
      },
    })
    return true
  } catch {
    return false
  }
}

TaskManager.defineTask(TAREA, async ({ data, error }) => {
  if (error) return
  const encuentroId = localStorage.getItem(CLAVE_ENCUENTRO)
  const ubicaciones = (data as { locations?: Location.LocationObject[] } | undefined)?.locations
  const ultima = ubicaciones?.[ubicaciones.length - 1]
  if (!encuentroId) {
    await detenerServicioEncuentro()
    return
  }
  if (!ultima) return
  try {
    const { data: filas, error: errorRpc } = await supabase.rpc('encuentro_sync', {
      p_id: encuentroId,
      p_lat: ultima.coords.latitude,
      p_lng: ultima.coords.longitude,
    })
    if (errorRpc) {
      // Sesion cerrada o encuentro que ya no es mio: no dejar el servicio huerfano.
      if (errorTerminal(errorRpc.message)) await detenerServicioEncuentro(encuentroId)
      return
    }
    const r = (filas as { estado: string; llegaron: boolean; distancia_m: number | null }[])[0]
    if (!r) return
    const decision = decidirTrasSync(r, localStorage.getItem(CLAVE_AVISADO) === '1')
    if (decision.avisarLlegada) {
      localStorage.setItem(CLAVE_AVISADO, '1')
      const nombre = (localStorage.getItem(CLAVE_NOMBRE) ?? 'tu contacto').split(' ')[0]
      await avisoLocal('Llegaron', `Ya estás con ${nombre}`)
    }
    if (decision.rearmar) localStorage.removeItem(CLAVE_AVISADO)
    if (decision.detener) await detenerServicioEncuentro(encuentroId)
  } catch {
    // Sin red: se reintenta en el proximo punto.
  }
})
