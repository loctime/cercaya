import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { fecha, textoDistancia, type Categoria } from '../lib/datos'
import { textoUrgencia, type EstadoPedido, type Urgencia } from '../lib/pedidos'
import { colores, espacio, fuentes, radio } from '../theme'
import { EstadoBadge } from './Chip'
import { Texto } from './ui'

export type PedidoLista = {
  id: string
  title: string
  category_id: number
  urgency: Urgencia
  zone_label: string | null
  status: EstadoPedido
  created_at: string
  distancia_km?: number | string | null
}

// accion = aviso destacado de lo que falta hacer ("Confirmá el trabajo").
export function TarjetaPedido({
  p,
  categorias,
  accion,
}: {
  p: PedidoLista
  categorias: Categoria[]
  accion?: string | null
}) {
  const cat = categorias.find((c) => c.id === p.category_id)
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: p.id } })}
      style={({ pressed }) => [estilos.tarjeta, pressed && { backgroundColor: colores.grupo }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <EstadoBadge estado={p.status} />
          <Texto suave style={{ fontSize: 13 }}>{fecha(p.created_at)}</Texto>
        </View>
        <Texto style={estilos.titulo} numberOfLines={2}>
          {p.title}
        </Texto>
        <Texto suave style={{ fontSize: 13 }}>
          {[cat?.name, p.zone_label, p.distancia_km != null ? textoDistancia(p.distancia_km) : null, textoUrgencia(p.urgency)]
            .filter(Boolean)
            .join(' · ')}
        </Texto>
        {accion ? (
          <View style={estilos.accion}>
            <Texto style={estilos.accionTexto}>{accion}</Texto>
          </View>
        ) : null}
      </View>
      <ChevronRight size={20} color={colores.texto2} />
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    marginHorizontal: espacio.l,
    padding: espacio.l,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  titulo: { fontFamily: fuentes.tituloSuave, fontSize: 17 },
  accion: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radio.s,
    backgroundColor: colores.naranjaSuave,
  },
  accionTexto: { fontFamily: fuentes.textoFuerte, fontSize: 13, color: colores.naranjaOscuro },
})
