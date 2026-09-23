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
        </Stack>
      </UbicacionProvider>
    </SesionProvider>
  )
}
