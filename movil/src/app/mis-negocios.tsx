import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { editarMiNegocio, misNegocios, ocultarMiNegocio, type MiNegocio } from '../lib/negocios'
import { useUbicacion } from '../lib/ubicacion'
import { colores, espacio, radio } from '../theme'

// Mis negocios: editar los datos y mostrarlos u ocultarlos del mapa.
export default function MisNegocios() {
  const [lista, setLista] = useState<MiNegocio[] | null>(null)

  const cargar = useCallback(() => {
    misNegocios()
      .then(setLista)
      .catch(() => setLista([]))
  }, [])
  useFocusEffect(cargar)

  if (lista === null) return <ActivityIndicator style={{ marginTop: espacio.xl }} color={colores.naranjaOscuro} />
  if (lista.length === 0) {
    return (
      <View style={{ padding: espacio.l }}>
        <Texto suave style={{ textAlign: 'center' }}>
          Todavía no tenés ningún negocio a tu nombre.
        </Texto>
      </View>
    )
  }
  return (
    <ScrollView contentContainerStyle={{ padding: espacio.l, gap: espacio.l }}>
      {lista.map((n) => (
        <Formulario key={n.id} negocio={n} alGuardar={cargar} />
      ))}
    </ScrollView>
  )
}

function Formulario({ negocio, alGuardar }: { negocio: MiNegocio; alGuardar: () => void }) {
  const { origen } = useUbicacion()
  const [nombre, setNombre] = useState(negocio.nombre)
  const [bio, setBio] = useState(negocio.bio ?? '')
  const [telefono, setTelefono] = useState(negocio.telefono ?? '')
  const [tipo, setTipo] = useState(negocio.tipo)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const oculto = negocio.estado === 'oculto'

  async function guardar() {
    setGuardando(true)
    try {
      await editarMiNegocio(negocio.id, { nombre, bio, telefono, tipo, ...(pos ?? {}) })
      Alert.alert('Listo', 'Guardamos los cambios.')
      alGuardar()
    } catch (e) {
      Alert.alert('No se pudo', (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function mostrar(valor: boolean) {
    try {
      await ocultarMiNegocio(negocio.id, !valor)
      alGuardar()
    } catch (e) {
      Alert.alert('No se pudo', (e as Error).message)
    }
  }

  return (
    <View style={estilos.caja}>
      <Titulo nivel={3}>{negocio.nombre}</Titulo>
      <View style={estilos.fila}>
        <Texto style={{ flex: 1 }}>Mostrar en el mapa</Texto>
        <Switch
          value={!oculto}
          onValueChange={mostrar}
          disabled={oculto && negocio.motivo_oculto !== 'dueno'}
          accessibilityLabel="Mostrar en el mapa"
        />
      </View>
      {oculto && negocio.motivo_oculto !== 'dueno' && (
        <Texto suave style={{ fontSize: 14 }}>
          Lo ocultó el equipo de CercaYa. Escribinos a cercaya@controlapps.ar.
        </Texto>
      )}
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={80} />
      <Campo etiqueta="Qué hacen" value={bio} onChangeText={setBio} multiline maxLength={300} />
      <Campo etiqueta="Teléfono (WhatsApp)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <View style={estilos.fila}>
        <Chip activo={tipo === 'local'} onPress={() => setTipo('local')}>
          Tengo local
        </Chip>
        <Chip activo={tipo === 'a_domicilio'} onPress={() => setTipo('a_domicilio')}>
          Voy a domicilio
        </Chip>
      </View>
      <Texto suave style={{ fontSize: 14 }}>
        {tipo === 'a_domicilio'
          ? 'Como vas a domicilio, mostramos tu ubicación aproximada y no tu teléfono.'
          : 'Se muestra el pin del local y tu teléfono.'}
      </Texto>
      <Boton variante="secundario" onPress={() => setPos({ lat: origen.lat, lng: origen.lng })}>
        {pos ? 'Ubicación actual elegida' : 'Usar mi ubicación actual'}
      </Boton>
      <Boton cargando={guardando} onPress={guardar}>
        Guardar
      </Boton>
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: {
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.fondo,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
})
