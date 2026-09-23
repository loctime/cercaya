import { useFocusEffect } from 'expo-router'
import { SearchX } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import { Chip } from '../components/Chip'
import { TarjetaPedido, type PedidoLista } from '../components/TarjetaPedido'
import { Vacio } from '../components/ui'
import { useCategorias } from '../lib/datos'
import { supabase } from '../lib/supabase'
import { colores, espacio } from '../theme'

type Fila = PedidoLista & { ya_me_ofreci: boolean }

// Para prestadores: pedidos abiertos cerca (por defecto de mis rubros y
// dentro de mi radio de cobertura).
export default function PedidosCerca() {
  const categorias = useCategorias()
  const [soloMisRubros, setSoloMisRubros] = useState(true)
  const [filas, setFilas] = useState<Fila[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      supabase
        .rpc('pedidos_cerca', { p_solo_mis_rubros: soloMisRubros })
        .then(({ data }) => setFilas((data as Fila[]) ?? []))
    }, [soloMisRubros]),
  )

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ gap: espacio.s, paddingBottom: espacio.xxl }}
      data={filas ?? []}
      keyExtractor={(f) => f.id}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: espacio.s, padding: espacio.l, paddingBottom: espacio.s }}>
          <Chip activo={soloMisRubros} onPress={() => setSoloMisRubros(true)}>
            Mis rubros
          </Chip>
          <Chip activo={!soloMisRubros} onPress={() => setSoloMisRubros(false)}>
            Todos
          </Chip>
        </View>
      }
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
