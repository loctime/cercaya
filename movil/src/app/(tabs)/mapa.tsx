import { router, useFocusEffect } from 'expo-router'
import { MapPinned } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Vacio } from '../../components/ui'
import { cargarMapa, type ContactoMapa } from '../../lib/contactos'
import { textoHace } from '../../lib/tiempo'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, radio } from '../../theme'

const REFRESCO_MS = 60_000

// Mapa de contactos que estan compartiendo su ubicacion (aproximada).
export default function Mapa() {
  const { origen } = useUbicacion()
  const [contactos, setContactos] = useState<ContactoMapa[]>([])

  // Se recarga al entrar a la pestania y cada minuto mientras esta a la vista.
  useFocusEffect(
    useCallback(() => {
      const cargar = () =>
        cargarMapa()
          .then(setContactos)
          .catch(() => {})
      cargar()
      const intervalo = setInterval(cargar, REFRESCO_MS)
      return () => clearInterval(intervalo)
    }, []),
  )

  return (
    <RequiereLogin
      icono={MapPinned}
      titulo="Tu mapa de contactos"
      texto="Entrá para ver las ubicaciones aproximadas de tus contactos."
    >
      <View style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: origen.lat, longitude: origen.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        >
          {contactos.map((c) => (
            <Marker
              key={c.user_id}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              opacity={c.desactualizada ? 0.55 : 1}
              title={c.full_name}
              description={`Actualizado ${textoHace(c.actualizada_at)}`}
              onCalloutPress={() => router.push({ pathname: '/persona/[id]', params: { id: c.user_id } })}
            />
          ))}
        </MapView>

        {contactos.length === 0 && (
          <View style={estilos.vacio}>
            <Vacio
              icono={MapPinned}
              titulo="Todavía no hay ubicaciones"
              texto="Agregá contactos y pediles que activen compartir ubicación."
            >
              <Boton variante="secundario" onPress={() => router.push('/contactos')}>
                Ir a Contactos
              </Boton>
            </Vacio>
          </View>
        )}

        <View style={estilos.nota}>
          <Texto suave>Las ubicaciones son aproximadas.</Texto>
        </View>
      </View>
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  vacio: {
    position: 'absolute',
    top: 80,
    left: espacio.l,
    right: espacio.l,
    backgroundColor: colores.fondo,
    borderRadius: radio.l,
  },
  nota: {
    position: 'absolute',
    bottom: espacio.l,
    left: espacio.l,
    backgroundColor: colores.fondo,
    padding: 10,
    borderRadius: radio.m,
  },
})
