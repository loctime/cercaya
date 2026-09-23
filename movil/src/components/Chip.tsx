import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ESTADOS, type EstadoPedido } from '../lib/pedidos'
import { colores, espacio, fuentes, radio } from '../theme'

// Opcion seleccionable (activa = naranja de marca con texto oscuro).
export function Chip({
  activo,
  onPress,
  children,
}: {
  activo?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      onPress={onPress}
      style={[estilos.chip, activo && estilos.activo]}
    >
      {typeof children === 'string' ? <Text style={estilos.texto}>{children}</Text> : children}
    </Pressable>
  )
}

export function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  const e = ESTADOS[estado]
  return (
    <View style={[estilos.badge, { backgroundColor: e.fondo }]}>
      <Text style={[estilos.badgeTexto, { color: e.tinta }]}>{e.texto}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: espacio.m,
    borderRadius: radio.full,
    borderWidth: 1.5,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activo: { backgroundColor: colores.naranja, borderColor: colores.naranja },
  texto: { fontFamily: fuentes.textoFuerte, fontSize: 14, color: colores.tinta },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radio.full },
  badgeTexto: { fontFamily: fuentes.textoFuerte, fontSize: 12 },
})
