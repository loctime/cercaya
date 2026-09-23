import { router } from 'expo-router'
import { Check, LocateFixed, MapPin } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Boton, Texto, Titulo } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useUbicacion, type Zona } from '../lib/ubicacion'
import { colores, espacio, radio } from '../theme'

// Elegir zona: GPS (con explicacion previa, antes del cartel del sistema)
// o una de las 6 localidades.
export default function Localidad() {
  const { origen, elegirZona, usarGps } = useUbicacion()
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estadoGps, setEstadoGps] = useState<'' | 'buscando' | 'denegado' | 'error'>('')

  useEffect(() => {
    supabase
      .from('zones')
      .select('id, name, lat, lng')
      .order('id')
      .then(({ data }) => setZonas(data ?? []))
  }, [])

  async function gps() {
    setEstadoGps('buscando')
    const r = await usarGps()
    if (r === 'ok') router.back()
    else setEstadoGps(r)
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.explicacion}>
        <LocateFixed size={28} color={colores.naranjaOscuro} />
        <Titulo nivel={3}>Usar mi ubicación</Titulo>
        <Texto suave>
          Para mostrarte prestadores cerca tuyo necesitamos saber tu zona. Nunca mostramos tu ubicación exacta a otras
          personas: solo ven la localidad y una distancia aproximada.
        </Texto>
        <Boton onPress={gps} cargando={estadoGps === 'buscando'} icono={LocateFixed}>
          Usar mi ubicación
        </Boton>
        {estadoGps === 'denegado' && (
          <View style={{ gap: espacio.s }}>
            <Texto style={{ color: colores.peligro }}>
              No diste permiso de ubicación. Podés elegir tu localidad abajo o activarlo en los ajustes del teléfono.
            </Texto>
            <Boton variante="secundario" onPress={() => Linking.openSettings()}>
              Abrir ajustes
            </Boton>
          </View>
        )}
        {estadoGps === 'error' && (
          <Texto style={{ color: colores.peligro }}>No pudimos obtener tu ubicación. Elegí tu localidad abajo.</Texto>
        )}
      </View>

      <Titulo nivel={3}>O elegí tu localidad</Titulo>
      <View style={estilos.lista}>
        {zonas.map((z, i) => {
          const activa = origen.fuente === 'manual' && origen.etiqueta === z.name
          return (
            <Pressable
              key={z.id}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              onPress={async () => {
                await elegirZona(z)
                router.back()
              }}
              style={[estilos.fila, i > 0 && estilos.separador]}
            >
              <MapPin size={20} color={colores.texto2} />
              <Texto style={{ flex: 1 }}>{z.name}</Texto>
              {activa && <Check size={20} color={colores.naranjaOscuro} />}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  explicacion: { gap: espacio.s, padding: espacio.l, borderRadius: radio.l, backgroundColor: colores.naranjaSuave },
  lista: { borderRadius: radio.m, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 52, paddingHorizontal: espacio.l },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde },
})
