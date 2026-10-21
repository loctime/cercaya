import { router, useFocusEffect } from 'expo-router'
import { MapPinned } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { AvisoEncuentro } from '../../components/AvisoEncuentro'
import { InterruptoresUbicacion } from '../../components/InterruptoresUbicacion'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Texto } from '../../components/ui'
import { cargarMapa, personasCerca, type ContactoMapa, type PersonaCerca } from '../../lib/contactos'
import { useCompartirUbicacion } from '../../lib/compartirUbicacion'
import { textoDistancia } from '../../lib/datos'
import { textoHace } from '../../lib/tiempo'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, radio } from '../../theme'

const REFRESCO_MS = 60_000

// Mapa con dos capas: mis contactos (naranja, ubicacion aproximada) y gente
// que eligio aparecer para todos (azul, solo el barrio).
export default function Mapa() {
  const { origen } = useUbicacion()
  const { compartiendo, publico } = useCompartirUbicacion()
  const [contactos, setContactos] = useState<ContactoMapa[]>([])
  const [cerca, setCerca] = useState<PersonaCerca[]>([])
  const [error, setError] = useState('')

  // Se recarga al entrar a la pestania, al tocar un interruptor y cada minuto.
  useFocusEffect(
    useCallback(() => {
      const cargar = () => {
        cargarMapa()
          .then((c) => {
            setContactos(c)
            setError('')
          })
          .catch((e) => setError(e.message))
        personasCerca()
          .then(setCerca)
          .catch(() => setCerca([]))
      }
      cargar()
      const intervalo = setInterval(cargar, REFRESCO_MS)
      return () => clearInterval(intervalo)
    }, [compartiendo, publico]),
  )

  const sinNadie = contactos.length === 0 && cerca.length === 0

  return (
    <RequiereLogin
      icono={MapPinned}
      titulo="Tu mapa"
      texto="Entrá para ver a tus contactos y a la gente que está cerca."
    >
      <View style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: origen.lat, longitude: origen.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
        >
          {contactos.map((c) => (
            <Marker
              key={`c-${c.user_id}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              pinColor={colores.naranja}
              opacity={c.desactualizada ? 0.55 : 1}
              title={c.full_name}
              description={`Contacto · actualizado ${textoHace(c.actualizada_at)}`}
              onCalloutPress={() => router.push({ pathname: '/persona/[id]', params: { id: c.user_id } })}
            />
          ))}
          {cerca.map((p) => (
            <Marker
              key={`p-${p.user_id}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              pinColor="#2563EB"
              title={p.full_name}
              description={[p.zona, textoDistancia(p.distancia_km), p.oficios.join(', ')].filter(Boolean).join(' · ')}
              onCalloutPress={() => router.push({ pathname: '/persona/[id]', params: { id: p.user_id } })}
            />
          ))}
        </MapView>

        <ScrollView style={estilos.panel} contentContainerStyle={{ gap: espacio.s }}>
          <AvisoEncuentro />
          <InterruptoresUbicacion />
          {sinNadie && (
            <View style={estilos.aviso}>
              <Texto suave>
                Todavía no hay nadie en el mapa. Agregá contactos desde la pestaña Contactos, o esperá a que alguien
                cerca elija aparecer.
              </Texto>
            </View>
          )}
        </ScrollView>

        <View style={estilos.nota}>
          <Texto suave>
            {error
              ? `No pudimos cargar los contactos: ${error}`
              : 'Naranja: contactos. Azul: gente cerca. Siempre aproximado.'}
          </Texto>
        </View>
      </View>
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  panel: { position: 'absolute', top: espacio.s, left: espacio.s, right: espacio.s, maxHeight: '55%' },
  aviso: { backgroundColor: colores.fondo, borderRadius: radio.l, padding: espacio.m },
  nota: {
    position: 'absolute',
    bottom: espacio.l,
    left: espacio.l,
    right: espacio.l,
    backgroundColor: colores.fondo,
    padding: 10,
    borderRadius: radio.m,
  },
})
