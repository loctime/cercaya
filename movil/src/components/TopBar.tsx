import { router, useFocusEffect } from 'expo-router'
import { Bell, ChevronDown, MapPin } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSesion } from '../lib/sesion'
import { useUbicacion } from '../lib/ubicacion'
import { supabase } from '../lib/supabase'
import { colores, espacio, radio } from '../theme'
import { Texto } from './ui'

// Barra superior de las pestanias: localidad a la izquierda, campanita a la derecha.
export function TopBar() {
  const insets = useSafeAreaInsets()
  const { sesion } = useSesion()
  const { origen } = useUbicacion()
  const [sinLeer, setSinLeer] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!sesion) {
        setSinLeer(0)
        return
      }
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .then(({ count }) => setSinLeer(count ?? 0))
    }, [sesion]),
  )

  return (
    <View style={[estilos.barra, { paddingTop: insets.top + espacio.s }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar localidad"
        style={estilos.zona}
        onPress={() => router.push('/localidad')}
      >
        <MapPin size={18} color={colores.naranjaOscuro} />
        <Texto fuerte numberOfLines={1}>{origen.etiqueta}</Texto>
        <ChevronDown size={16} color={colores.texto2} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sinLeer ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
        style={estilos.campana}
        onPress={() => router.push(sesion ? '/notificaciones' : '/login')}
      >
        <Bell size={22} color={colores.tinta} />
        {sinLeer > 0 && <View style={estilos.punto} />}
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.l,
    paddingBottom: espacio.s,
    backgroundColor: colores.fondo,
  },
  zona: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, paddingVertical: espacio.s, flexShrink: 1 },
  campana: {
    width: 44,
    height: 44,
    borderRadius: radio.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.grupo,
  },
  punto: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: radio.full,
    backgroundColor: colores.peligro,
    borderWidth: 1.5,
    borderColor: colores.grupo,
  },
})
