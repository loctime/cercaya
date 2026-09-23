import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SesionProvider } from '../lib/sesion'
import { UbicacionProvider } from '../lib/ubicacion'
import { colores, fuentes } from '../theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fuentesListas] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })

  useEffect(() => {
    if (fuentesListas) SplashScreen.hideAsync()
  }, [fuentesListas])

  if (!fuentesListas) return null

  return (
    <SesionProvider>
      <UbicacionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTitleStyle: { fontFamily: fuentes.titulo, color: colores.tinta },
            headerTintColor: colores.tinta,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colores.fondo },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ presentation: 'modal', title: 'Entrar' }} />
          <Stack.Screen name="publicar" options={{ presentation: 'modal', title: 'Publicar pedido' }} />
          <Stack.Screen name="localidad" options={{ presentation: 'modal', title: 'Tu zona' }} />
          <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="prestador/[id]" options={{ title: '' }} />
          <Stack.Screen name="denunciar" options={{ presentation: 'modal', title: 'Denunciar' }} />
          <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
          <Stack.Screen name="pedido/[id]" options={{ title: '' }} />
          <Stack.Screen name="calificar" options={{ presentation: 'modal', title: 'Calificar' }} />
          <Stack.Screen name="pedidos-cerca" options={{ title: 'Pedidos cerca' }} />
          <Stack.Screen name="editar-perfil" options={{ title: 'Mis datos' }} />
          <Stack.Screen name="mis-servicios" options={{ title: 'Mis servicios' }} />
          <Stack.Screen name="privacidad" options={{ title: 'Privacidad' }} />
          <Stack.Screen name="ajustes-notificaciones" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="admin" options={{ title: 'Administración' }} />
        </Stack>
      </UbicacionProvider>
    </SesionProvider>
  )
}
