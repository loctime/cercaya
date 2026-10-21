import { Alert, StyleSheet, Switch, View } from 'react-native'
import { useCompartirUbicacion } from '../lib/compartirUbicacion'
import { colores, espacio } from '../theme'
import { Texto } from './ui'

// Los dos interruptores de privacidad de la ubicacion, siempre con el mismo
// texto: para mis contactos (punto de ~300 m) y para todos (barrio de ~1-2 km).
export function InterruptoresUbicacion() {
  const u = useCompartirUbicacion()

  function avisar(resultado: 'ok' | 'denegado' | 'error') {
    if (resultado === 'error') Alert.alert('No pudimos activarlo', 'Probá de nuevo en un rato.')
    else if (resultado === 'denegado') {
      Alert.alert('Permiso de ubicación', 'Activá la ubicación desde Ajustes para poder mostrarla.', [
        { text: 'Ahora no' },
        { text: 'Abrir Ajustes', onPress: u.abrirAjustes },
      ])
    }
  }

  return (
    <View style={estilos.caja}>
      <Fila
        titulo="Mostrar mi ubicación a mis contactos"
        detalle="Solo quienes aceptaste. Aproximada, se actualiza cada unos 10 minutos."
        valor={u.compartiendo}
        onChange={async (v) => (v ? avisar(await u.activar()) : u.desactivar())}
      />
      <View style={estilos.separador} />
      <Fila
        titulo="Mostrar mi ubicación a todos"
        detalle="Cualquiera con cuenta ve tu nombre, tus oficios y tu barrio. Nunca tu punto exacto."
        valor={u.publico}
        onChange={async (v) => (v ? avisar(await u.activarPublico()) : u.desactivarPublico())}
      />
    </View>
  )
}

function Fila({
  titulo,
  detalle,
  valor,
  onChange,
}: {
  titulo: string
  detalle: string
  valor: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={estilos.fila}>
      <View style={{ flex: 1 }}>
        <Texto fuerte>{titulo}</Texto>
        <Texto suave style={{ fontSize: 14 }}>
          {detalle}
        </Texto>
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        trackColor={{ true: colores.naranja }}
        accessibilityLabel={titulo}
      />
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: { backgroundColor: colores.fondo, borderRadius: 16, padding: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xs },
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: espacio.xs },
})
