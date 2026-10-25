import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { MessageCircle, Search, X } from 'lucide-react-native'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { buscarServicio } from '../lib/contactos'
import { abrirChat } from '../lib/contacto'
import { textoDistancia } from '../lib/datos'
import { supabase } from '../lib/supabase'
import { consultaValida, nuevaSecuencia, RADIO_BASE, RADIO_MAX, type ResultadoServicio } from '../lib/trabajo'
import { useUbicacion } from '../lib/ubicacion'
import { colores, espacio, fuentes, radio } from '../theme'
import { iniciales } from './Avatar'
import { Boton, Texto, Titulo } from './ui'

const ESPERA_MS = 400

type Estado = 'inicial' | 'buscando' | 'listo' | 'error'

// Modo Trabajo: buscador libre ("canilla rota") y solo los pines de quienes
// ofrecen eso. Contacto por chat directo.
export function MapaTrabajo({ selector }: { selector: ReactNode }) {
  const { origen } = useUbicacion()
  const [texto, setTexto] = useState('')
  const [radioKm, setRadioKm] = useState(RADIO_BASE)
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [resultados, setResultados] = useState<ResultadoServicio[]>([])
  const [estado, setEstado] = useState<Estado>('inicial')
  const [seleccionado, setSeleccionado] = useState<ResultadoServicio | null>(null)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [reintento, setReintento] = useState(0)
  const [abriendoChat, setAbriendoChat] = useState(false)
  const secuencia = useRef(nuevaSecuencia()).current
  const mapaRef = useRef<MapView>(null)

  // Sugerencias con el buscador vacio: tareas del catalogo.
  useEffect(() => {
    supabase
      .from('habilidades_catalogo')
      .select('label')
      .order('tipo', { ascending: false })
      .order('label')
      .limit(6)
      .then(({ data }) => setSugerencias((data ?? []).map((x) => x.label as string)))
  }, [])

  // Busqueda con espera; la respuesta de una consulta vieja se descarta.
  useEffect(() => {
    const vigente = secuencia()
    setSeleccionado(null)
    if (!consultaValida(texto)) {
      setResultados([])
      setEstado('inicial')
      return () => {
        secuencia()
      }
    }
    setEstado('buscando')
    const espera = setTimeout(async () => {
      try {
        const r = await buscarServicio(texto.trim(), radioKm, soloDisponibles)
        if (!vigente()) return
        setResultados(r)
        setEstado('listo')
        const coords = r.map((p) => ({ latitude: Number(p.lat), longitude: Number(p.lng) }))
        if (coords.length > 0) {
          mapaRef.current?.fitToCoordinates([...coords, { latitude: origen.lat, longitude: origen.lng }], {
            edgePadding: { top: 170, right: 60, bottom: 260, left: 60 },
            animated: true,
          })
        }
      } catch {
        if (vigente()) setEstado('error')
      }
    }, ESPERA_MS)
    return () => {
      clearTimeout(espera)
      secuencia()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, radioKm, soloDisponibles, reintento])

  function escribir(t: string) {
    setTexto(t)
    setRadioKm(RADIO_BASE)
  }

  function elegir(p: ResultadoServicio) {
    Haptics.selectionAsync()
    setSeleccionado(p)
    mapaRef.current?.animateToRegion(
      { latitude: Number(p.lat) - 0.006, longitude: Number(p.lng), latitudeDelta: 0.03, longitudeDelta: 0.03 },
      300,
    )
  }

  async function escribirleA(p: ResultadoServicio) {
    setAbriendoChat(true)
    try {
      await abrirChat(p.user_id)
    } finally {
      setAbriendoChat(false)
    }
  }

  const hayTexto = consultaValida(texto)

  return (
    <View style={estilos.contenedor}>
      <MapView
        ref={mapaRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: origen.lat, longitude: origen.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={() => setSeleccionado(null)}
      >
        {resultados.map((p) => {
          const lat = Number(p.lat)
          const lng = Number(p.lng)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return (
            <Marker
              key={p.user_id}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => elegir(p)}
            >
              <PinServicio p={p} seleccionado={seleccionado?.user_id === p.user_id} />
            </Marker>
          )
        })}
      </MapView>

      {selector}

      <View style={estilos.buscador}>
        <View style={estilos.caja}>
          <Search size={18} color={colores.texto2} />
          <TextInput
            value={texto}
            onChangeText={escribir}
            placeholder="Qué necesitás? Ej. canilla rota"
            placeholderTextColor={colores.texto2}
            style={estilos.input}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar un servicio"
          />
          {estado === 'buscando' && <ActivityIndicator size="small" color={colores.naranjaOscuro} />}
          {texto.length > 0 && (
            <Pressable onPress={() => escribir('')} accessibilityLabel="Borrar búsqueda" hitSlop={8}>
              <X size={18} color={colores.texto2} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync()
            setSoloDisponibles((v) => !v)
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: soloDisponibles }}
          style={[estilos.filtro, soloDisponibles && estilos.filtroActivo]}
        >
          <View style={[estilos.punto, { backgroundColor: colores.exito }]} />
          <Texto fuerte={soloDisponibles} style={{ fontSize: 14 }}>
            Solo disponibles ahora
          </Texto>
        </Pressable>

        {!hayTexto && sugerencias.length > 0 && (
          <View style={estilos.sugerencias}>
            {sugerencias.map((s) => (
              <Pressable key={s} onPress={() => escribir(s)} style={estilos.sugerencia}>
                <Texto style={{ fontSize: 14 }}>{s}</Texto>
              </Pressable>
            ))}
          </View>
        )}

        {estado === 'error' && (
          <View style={estilos.panel}>
            <Texto style={{ textAlign: 'center' }}>No pudimos buscar. Probá de nuevo.</Texto>
            <Boton variante="secundario" onPress={() => setReintento((n) => n + 1)}>
              Reintentar
            </Boton>
          </View>
        )}

        {estado === 'listo' && resultados.length === 0 && (
          <View style={estilos.panel}>
            <Titulo nivel={3} style={{ textAlign: 'center' }}>
              {soloDisponibles ? 'Nadie disponible ahora cerca' : 'Todavía nadie cerca ofrece esto'}
            </Titulo>
            <Texto suave style={{ textAlign: 'center', fontSize: 14 }}>
              Buscamos cerca de {origen.etiqueta}, hasta {radioKm} km.
            </Texto>
            {soloDisponibles && (
              <Boton variante="secundario" onPress={() => setSoloDisponibles(false)}>
                Ver también a los no disponibles
              </Boton>
            )}
            {!soloDisponibles && radioKm < RADIO_MAX && (
              <Boton variante="secundario" onPress={() => setRadioKm(RADIO_MAX)}>
                Buscar más lejos
              </Boton>
            )}
          </View>
        )}
      </View>

      {seleccionado && (
        <View style={estilos.tarjeta}>
          <View style={estilos.tirador} />
          <View style={estilos.cabeceraTarjeta}>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto fuerte style={{ fontSize: 17 }} numberOfLines={1}>
                {seleccionado.full_name}
              </Texto>
              <Texto style={{ fontSize: 14 }} numberOfLines={1}>
                {seleccionado.coincide}
              </Texto>
              {seleccionado.disponible && (
                <View style={estilos.filaDisponible}>
                  <View style={[estilos.punto, { backgroundColor: colores.exito }]} />
                  <Texto fuerte style={{ fontSize: 14, color: colores.exito }}>
                    Disponible ahora
                  </Texto>
                </View>
              )}
              <Texto suave style={{ fontSize: 14 }} numberOfLines={1}>
                {[seleccionado.zona, textoDistancia(seleccionado.distancia_km)].filter(Boolean).join(' · ')}
              </Texto>
            </View>
            {seleccionado.es_contacto && (
              <View style={estilos.insignia}>
                <Texto fuerte style={{ fontSize: 13 }}>
                  Es tu contacto
                </Texto>
              </View>
            )}
            <Pressable onPress={() => setSeleccionado(null)} accessibilityLabel="Cerrar" hitSlop={10}>
              <X size={20} color={colores.texto2} />
            </Pressable>
          </View>
          <View style={estilos.acciones}>
            <Boton icono={MessageCircle} cargando={abriendoChat} onPress={() => escribirleA(seleccionado)} style={{ flex: 1 }}>
              Escribirle
            </Boton>
            <Boton
              variante="secundario"
              onPress={() => router.push({ pathname: '/persona/[id]', params: { id: seleccionado.user_id } })}
              style={{ flex: 1 }}
            >
              Ver perfil
            </Boton>
          </View>
        </View>
      )}
    </View>
  )
}

function PinServicio({ p, seleccionado }: { p: ResultadoServicio; seleccionado: boolean }) {
  return (
    <View
      style={[
        estilosPin.burbuja,
        p.es_contacto && { borderColor: colores.tinta },
        seleccionado && { borderWidth: 4, transform: [{ scale: 1.15 }] },
      ]}
    >
      {p.avatar_url ? (
        <Image source={{ uri: p.avatar_url }} style={estilosPin.avatar} resizeMode="cover" />
      ) : (
        <Text style={estilosPin.inicial}>{iniciales(p.full_name)}</Text>
      )}
      {p.disponible && <View style={estilosPin.disponible} />}
    </View>
  )
}

const estilosPin = StyleSheet.create({
  burbuja: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colores.naranja,
    borderWidth: 3,
    borderColor: colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  inicial: { fontFamily: fuentes.titulo, fontSize: 16, color: colores.tinta },
  disponible: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colores.exito,
    borderWidth: 2,
    borderColor: colores.blanco,
  },
})

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  buscador: { position: 'absolute', top: 56, left: espacio.m, right: espacio.m, gap: espacio.s },
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    backgroundColor: colores.fondo,
    borderRadius: radio.l,
    paddingHorizontal: espacio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, fontFamily: fuentes.texto, color: colores.tinta },
  filtro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    alignSelf: 'flex-start',
    backgroundColor: colores.fondo,
    borderRadius: radio.full,
    paddingHorizontal: espacio.m,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filtroActivo: { borderColor: colores.exito, backgroundColor: '#F0FDF4' },
  punto: { width: 10, height: 10, borderRadius: 5 },
  filaDisponible: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  sugerencia: {
    backgroundColor: colores.fondo,
    borderRadius: radio.full,
    paddingHorizontal: espacio.m,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  panel: {
    backgroundColor: colores.fondo,
    borderRadius: radio.l,
    padding: espacio.l,
    gap: espacio.s,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  tarjeta: {
    position: 'absolute',
    left: espacio.m,
    right: espacio.m,
    bottom: espacio.m,
    backgroundColor: colores.fondo,
    borderRadius: 20,
    padding: espacio.m,
    gap: espacio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tirador: { width: 32, height: 4, borderRadius: 2, backgroundColor: colores.borde, alignSelf: 'center' },
  cabeceraTarjeta: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  insignia: { backgroundColor: colores.naranjaSuave, borderRadius: radio.full, paddingHorizontal: 10, paddingVertical: 3 },
  acciones: { flexDirection: 'row', gap: espacio.s },
})
