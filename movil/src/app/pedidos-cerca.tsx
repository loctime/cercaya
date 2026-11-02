import { router, useFocusEffect } from 'expo-router'
import { List, Map, SearchX } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native'
import MapView, { Callout, Marker } from 'react-native-maps'
import { Chip } from '../components/Chip'
import { TarjetaPedido, type PedidoLista } from '../components/TarjetaPedido'
import { Texto, Vacio } from '../components/ui'
import { useCategorias } from '../lib/datos'
import { supabase } from '../lib/supabase'
import { colores, espacio, fuentes, radio } from '../theme'

type Fila = PedidoLista & { ya_me_ofreci: boolean; map_lat: number | string; map_lng: number | string }
type Vista = 'lista' | 'mapa'

// Para prestadores: pedidos abiertos cerca (por defecto de mis rubros y
// dentro de mi radio de cobertura).
export default function PedidosCerca() {
  const categorias = useCategorias()
  const [soloMisRubros, setSoloMisRubros] = useState(true)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [vista, setVista] = useState<Vista>('lista')
  const mapa = useRef<MapView>(null)

  useFocusEffect(
    useCallback(() => {
      supabase
        .rpc('pedidos_cerca', { p_solo_mis_rubros: soloMisRubros })
        .then(({ data }) => setFilas((data as Fila[]) ?? []))
    }, [soloMisRubros]),
  )

  useEffect(() => {
    if (vista !== 'mapa' || !filas?.length) return
    const puntos = filas
      .map((f) => ({ latitude: Number(f.map_lat), longitude: Number(f.map_lng) }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    if (puntos.length) setTimeout(() => mapa.current?.fitToCoordinates(puntos, { edgePadding: { top: 70, right: 50, bottom: 70, left: 50 }, animated: true }), 0)
  }, [filas, vista])

  const selector = (
    <View style={estilos.encabezado}>
      <View style={estilos.fila}>
        <Chip activo={soloMisRubros} onPress={() => setSoloMisRubros(true)}>Mis rubros</Chip>
        <Chip activo={!soloMisRubros} onPress={() => setSoloMisRubros(false)}>Todos</Chip>
      </View>
      <View style={estilos.selector} accessibilityRole="tablist">
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: vista === 'lista' }} onPress={() => setVista('lista')} style={[estilos.opcion, vista === 'lista' && estilos.opcionActiva]}>
          <List size={18} color={colores.tinta} />
          <Texto style={estilos.opcionTexto}>Lista</Texto>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: vista === 'mapa' }} onPress={() => setVista('mapa')} style={[estilos.opcion, vista === 'mapa' && estilos.opcionActiva]}>
          <Map size={18} color={colores.tinta} />
          <Texto style={estilos.opcionTexto}>Mapa</Texto>
        </Pressable>
      </View>
      {vista === 'mapa' && <Texto suave style={estilos.privacidad}>Los puntos son aproximados. La dirección exacta nunca aparece en el mapa.</Texto>}
    </View>
  )

  if (vista === 'mapa') {
    return (
      <View style={estilos.mapaPantalla}>
        {selector}
        {filas === null ? <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} /> : filas.length === 0 ? (
          <Vacio icono={SearchX} titulo="No hay pedidos abiertos cerca" texto="Cuando un vecino publique un pedido de tus rubros en tu zona, te avisamos." />
        ) : (
          <MapView ref={mapa} style={estilos.mapa} initialRegion={{ latitude: -33.4833, longitude: -60.0167, latitudeDelta: 0.12, longitudeDelta: 0.12 }}>
            {filas.map((f) => {
              const latitude = Number(f.map_lat)
              const longitude = Number(f.map_lng)
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
              const categoria = categorias.find((c) => c.id === f.category_id)
              return <Marker key={f.id} coordinate={{ latitude, longitude }} pinColor={colores.naranja}>
                <Callout onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: f.id } })}>
                  <View style={estilos.globo}>
                    <Texto fuerte>{f.title}</Texto>
                    <Texto suave>{[categoria?.name, f.zone_label, f.distancia_km != null ? `a ~${f.distancia_km} km` : null].filter(Boolean).join(' · ')}</Texto>
                    <Texto style={estilos.verPedido}>Ver pedido</Texto>
                  </View>
                </Callout>
              </Marker>
            })}
          </MapView>
        )}
      </View>
    )
  }

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ gap: espacio.s, paddingBottom: espacio.xxl }}
      data={filas ?? []}
      keyExtractor={(f) => f.id}
      ListHeaderComponent={selector}
      renderItem={({ item }) => (
        <TarjetaPedido p={item} categorias={categorias} accion={item.ya_me_ofreci ? 'Ya te ofreciste' : null} />
      )}
      ListEmptyComponent={
        filas === null ? (
          <ActivityIndicator color={colores.naranjaOscuro} style={{ marginTop: espacio.xl }} />
        ) : (
          <Vacio
            icono={SearchX}
            titulo="No hay pedidos abiertos cerca"
            texto="Cuando un vecino publique un pedido de tus rubros en tu zona, te avisamos."
          />
        )
      }
    />
  )
}

const estilos = StyleSheet.create({
  mapaPantalla: { flex: 1, backgroundColor: colores.fondo },
  encabezado: { padding: espacio.l, gap: espacio.s },
  fila: { flexDirection: 'row', gap: espacio.s },
  selector: { flexDirection: 'row', backgroundColor: colores.grupo, borderRadius: radio.m, padding: 4 },
  opcion: { flex: 1, flexDirection: 'row', minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radio.s },
  opcionActiva: { backgroundColor: colores.fondo, borderWidth: 1, borderColor: colores.borde },
  opcionTexto: { fontFamily: fuentes.textoFuerte, fontSize: 14 },
  privacidad: { fontSize: 13, lineHeight: 18 },
  mapa: { flex: 1 },
  globo: { width: 220, gap: 4, padding: 4 },
  verPedido: { marginTop: 2, color: colores.naranjaOscuro, fontFamily: fuentes.textoFuerte },
})
