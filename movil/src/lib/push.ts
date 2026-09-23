// Notificaciones push (Expo Push). El envio lo hace la base (migracion
// 0011) cada vez que se crea un aviso; aca solo se registra el celular y
// se maneja el toque en la notificacion.
//
// Expo Go en Android ya no soporta push: ahi no se carga el modulo (solo
// importarlo muestra un error). Funciona en el "development build" y en
// la app publicada.
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Device from 'expo-device'
import { router } from 'expo-router'
import { Alert, Platform } from 'react-native'
import { supabase } from './supabase'

const CLAVE_PREGUNTADO = 'cercaya.push.preguntado'
const CLAVE_TOKEN = 'cercaya.push.token'

export const pushDisponible =
  Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

async function modulo() {
  return import('expo-notifications')
}

// A donde lleva tocar la notificacion, segun lo que trae en data.
function destino(data: Record<string, unknown> | undefined) {
  if (typeof data?.conversation_id === 'string') {
    return { pathname: '/chat/[id]' as const, params: { id: data.conversation_id } }
  }
  if (typeof data?.job_id === 'string') {
    return { pathname: '/pedido/[id]' as const, params: { id: data.job_id } }
  }
  return '/notificaciones' as const
}

export async function configurarPush() {
  if (!pushDisponible) return () => {}
  const N = await modulo()
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', {
      name: 'Avisos de CercaYa',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#FF7A00',
    })
  }
  const ir = (n: { request: { content: { data?: Record<string, unknown> } } }) =>
    router.push(destino(n.request.content.data))
  const ultima = N.getLastNotificationResponse()
  // Si la app se abrio tocando una notificacion: esperar a que la navegacion este montada.
  if (ultima?.notification) setTimeout(() => ir(ultima.notification), 400)
  const sub = N.addNotificationResponseReceivedListener((r) => ir(r.notification))
  return () => sub.remove()
}

async function guardarToken() {
  if (!projectId) return false
  try {
    const N = await modulo()
    // SERVICE_NOT_AVAILABLE suele ser pasajero (servicios de Google
    // arrancando, mala señal): se reintenta antes de rendirse.
    let token = ''
    for (let intento = 1; ; intento++) {
      try {
        token = (await N.getExpoPushTokenAsync({ projectId })).data
        break
      } catch (e) {
        if (intento >= 3) throw e
        await new Promise((r) => setTimeout(r, intento * 3000))
      }
    }
    const { error } = await supabase.rpc('registrar_push_token', { p_token: token, p_platform: Platform.OS })
    if (error) throw error
    localStorage.setItem(CLAVE_TOKEN, token)
    return true
  } catch (e) {
    // Visible en la terminal del servidor de desarrollo. En Android, sin
    // Firebase (google-services.json) getExpoPushTokenAsync falla aca.
    console.warn('[push] no se pudo registrar el celular:', e instanceof Error ? e.message : e)
    return false
  }
}

// Se llama al tener sesion. Si ya hay permiso, registra el token en
// silencio. Si nunca se pregunto, explica primero y despues pide el
// permiso del sistema (una sola vez).
export async function prepararPushConSesion() {
  if (!pushDisponible || !projectId) return
  try {
    const N = await modulo()
    const { status } = await N.getPermissionsAsync()
    if (status === 'granted') return guardarToken()
    if (status !== 'undetermined' || localStorage.getItem(CLAVE_PREGUNTADO)) return
    localStorage.setItem(CLAVE_PREGUNTADO, '1')
    Alert.alert(
      'Enterate al toque',
      'Te avisamos cuando te escriben, cuando alguien se interesa en tu pedido y, si ofrecés servicios, cuando hay un pedido de tu rubro cerca. Podés elegir qué avisos recibir en Perfil > Notificaciones.',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Activar',
          onPress: async () => {
            const r = await N.requestPermissionsAsync()
            if (r.granted) await guardarToken()
          },
        },
      ],
    )
  } catch (e) {
    // Sin push la app funciona igual: los avisos quedan en la campanita.
    console.warn('[push]', e instanceof Error ? e.message : e)
  }
}

// Al cerrar sesion, este celular deja de recibir avisos de esa cuenta.
export async function olvidarTokenDeEsteCelular() {
  const token = localStorage.getItem(CLAVE_TOKEN)
  if (!token) return
  await supabase.from('push_tokens').delete().eq('token', token)
  localStorage.removeItem(CLAVE_TOKEN)
}

// Para el boton "Activar notificaciones" en ajustes, si antes dijo que no.
export async function estadoPermisoPush(): Promise<'no_disponible' | 'activo' | 'pendiente' | 'denegado'> {
  if (!pushDisponible || !projectId) return 'no_disponible'
  const N = await modulo()
  const { status } = await N.getPermissionsAsync()
  return status === 'granted' ? 'activo' : status === 'undetermined' ? 'pendiente' : 'denegado'
}

export async function pedirPermisoPush() {
  const N = await modulo()
  const r = await N.requestPermissionsAsync()
  return r.granted && (await guardarToken())
}
