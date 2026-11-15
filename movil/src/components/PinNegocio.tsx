import { Store } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { colores } from '../theme'

// Pin de un negocio: cuadrado redondeado con ícono de tienda, para no
// confundirlo con las personas (círculos). Naranja = ya tiene dueño;
// blanco con borde naranja = perfil sin reclamar.
export function PinNegocio({ reclamado, seleccionado }: { reclamado: boolean; seleccionado: boolean }) {
  return (
    <View
      style={[
        estilos.pin,
        reclamado ? estilos.reclamado : estilos.sinReclamar,
        seleccionado && { borderWidth: 4, transform: [{ scale: 1.15 }] },
      ]}
    >
      <Store size={22} color={colores.tinta} />
    </View>
  )
}

const estilos = StyleSheet.create({
  pin: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reclamado: { backgroundColor: colores.naranja, borderColor: colores.blanco },
  sinReclamar: { backgroundColor: colores.blanco, borderColor: colores.naranja },
})
