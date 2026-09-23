import { router } from 'expo-router'
import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useSesion } from '../lib/sesion'
import { colores } from '../theme'
import { Boton, Vacio } from './ui'

// Envuelve pestanias que solo tienen sentido con cuenta (Pedidos, Mensajes).
// Los invitados ven una invitacion a entrar en lugar de un muro.
export function RequiereLogin({
  icono,
  titulo,
  texto,
  children,
}: {
  icono: LucideIcon
  titulo: string
  texto: string
  children: ReactNode
}) {
  const { cargando, sesion } = useSesion()
  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={colores.naranjaOscuro} />
      </View>
    )
  }
  if (!sesion) {
    return (
      <Vacio icono={icono} titulo={titulo} texto={texto}>
        <Boton onPress={() => router.push('/login')}>Entrar o crear cuenta</Boton>
      </Vacio>
    )
  }
  return <>{children}</>
}
