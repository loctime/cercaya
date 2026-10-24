import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, View } from 'react-native'
import { colores, espacio, fuentes, radio } from '../theme'
import { Texto } from './ui'

export type ModoMapa = 'amigos' | 'trabajo'

// Interruptor Amigos | Trabajo, flotando arriba del mapa.
export function SelectorModo({ modo, onCambiar }: { modo: ModoMapa; onCambiar: (m: ModoMapa) => void }) {
  return (
    <View style={estilos.fila} pointerEvents="box-none">
      <View style={estilos.pildora} accessibilityRole="tablist">
        {(['amigos', 'trabajo'] as const).map((m) => {
          const activo = modo === m
          return (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              onPress={() => {
                if (activo) return
                Haptics.selectionAsync()
                onCambiar(m)
              }}
              style={[estilos.boton, activo && estilos.botonActivo]}
            >
              <Texto fuerte style={[estilos.texto, activo && estilos.textoActivo]}>
                {m === 'amigos' ? 'Amigos' : 'Trabajo'}
              </Texto>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  fila: { position: 'absolute', top: espacio.s, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  pildora: {
    flexDirection: 'row',
    backgroundColor: colores.fondo,
    borderRadius: radio.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  boton: { paddingHorizontal: espacio.l, paddingVertical: 8, borderRadius: radio.full, minWidth: 96, alignItems: 'center' },
  botonActivo: { backgroundColor: colores.naranja },
  texto: { fontSize: 15, color: colores.texto2, fontFamily: fuentes.textoFuerte },
  textoActivo: { color: colores.tinta },
})
