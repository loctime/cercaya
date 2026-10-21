import { router, useFocusEffect } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { useCallback, useState } from 'react'
import { Navigation } from 'lucide-react-native'
import { misEncuentros, type EncuentroResumen } from '../lib/encuentros'
import { colores, espacio, radio } from '../theme'
import { Texto } from './ui'

const CADA_MS = 15_000

function textoDe(e: EncuentroResumen) {
  const nombre = e.otro_nombre.split(' ')[0]
  if (e.estado === 'activo') return { titulo: `En camino con ${nombre}`, accion: 'Abrir' }
  if (e.soy_solicitante) return { titulo: `Esperando que ${nombre} acepte`, accion: 'Ver' }
  return { titulo: `${nombre} va para allá`, accion: 'Responder' }
}

// Carteles de "Voy para alla" abiertos: solicitud recibida, enviada o en curso.
export function AvisoEncuentro() {
  const [abiertos, setAbiertos] = useState<EncuentroResumen[]>([])

  useFocusEffect(
    useCallback(() => {
      const cargar = () =>
        misEncuentros()
          .then(setAbiertos)
          .catch(() => {})
      cargar()
      const intervalo = setInterval(cargar, CADA_MS)
      return () => clearInterval(intervalo)
    }, []),
  )

  if (abiertos.length === 0) return null
  return (
    <View style={estilos.lista}>
      {abiertos.map((e) => {
        const { titulo, accion } = textoDe(e)
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`${titulo}. ${accion}`}
            onPress={() => router.push({ pathname: '/encuentro/[id]', params: { id: e.id } })}
            style={estilos.cartel}
          >
            <Navigation size={22} color={colores.tinta} />
            <Texto fuerte style={{ flex: 1 }}>
              {titulo}
            </Texto>
            <Texto style={{ color: colores.naranjaOscuro }}>{accion}</Texto>
          </Pressable>
        )
      })}
    </View>
  )
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.s },
  cartel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.naranjaSuave,
    borderRadius: radio.l,
    padding: espacio.m,
  },
})
