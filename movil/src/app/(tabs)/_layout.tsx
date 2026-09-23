import * as Haptics from 'expo-haptics'
import { router, Tabs } from 'expo-router'
import { ClipboardList, House, MessageCircle, Plus, UserRound } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { TopBar } from '../../components/TopBar'
import { useSesion } from '../../lib/sesion'
import { colores, fuentes, radio } from '../../theme'

// Boton central "Pedir": no es una pestania, abre el modal de publicar
// (o el login si es invitado).
function BotonPedir() {
  const { sesion } = useSesion()
  return (
    <View style={estilos.fabContenedor} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Publicar un pedido"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push(sesion ? '/publicar' : '/login')
        }}
        style={({ pressed }) => [estilos.fab, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Plus size={30} color={colores.tinta} strokeWidth={2.5} />
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colores.naranjaOscuro,
        tabBarInactiveTintColor: colores.texto2,
        tabBarLabelStyle: { fontFamily: fuentes.textoMedio, fontSize: 12 },
        tabBarStyle: { borderTopColor: colores.borde, paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: ({ color }) => <House size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{ title: 'Pedidos', tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="pedir"
        options={{ title: '', tabBarButton: () => <BotonPedir /> }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{ title: 'Mensajes', tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ color }) => <UserRound size={24} color={color} /> }}
      />
    </Tabs>
  )
}

const estilos = StyleSheet.create({
  fabContenedor: { flex: 1, alignItems: 'center' },
  fab: {
    width: 60,
    height: 60,
    marginTop: -22,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colores.fondo,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
