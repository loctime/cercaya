import { useCallback, useState } from 'react'
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Users } from 'lucide-react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { Avatar } from '../../components/Avatar'
import {
  buscar,
  cargarContactos,
  responder,
  solicitar,
  type Contacto,
  type ResultadoBusqueda,
} from '../../lib/contactos'
import { colores, espacio } from '../../theme'
export default function Contactos() {
  const [lista, setLista] = useState<Contacto[]>([]),
    [q, setQ] = useState(''),
    [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const cargar = () =>
    cargarContactos()
      .then(setLista)
      .catch(() => {})
  useFocusEffect(
    useCallback(() => {
      cargar()
    }, []),
  )
  async function hacerBuscar(t: string) {
    setQ(t)
    if (t.trim().length < 3) return setResultados([])
    try {
      setResultados(await buscar(t))
    } catch {}
  }
  async function accion(fn: () => Promise<unknown>) {
    try {
      await fn()
      await cargar()
      setResultados(q.length >= 3 ? await buscar(q) : [])
    } catch (e: any) {
      Alert.alert('No se pudo completar', e.message)
    }
  }
  const recibidas = lista.filter((x) => x.estado === 'recibida'),
    aceptados = lista.filter((x) => x.estado === 'aceptado')
  return (
    <RequiereLogin
      icono={Users}
      titulo="Tus contactos"
      texto="Entrá para agregar vecinos y compartir ubicación si querés."
    >
      <FlatList
        contentContainerStyle={{ padding: espacio.l, gap: espacio.m }}
        data={aceptados}
        keyExtractor={(x) => x.user_id}
        ListHeaderComponent={
          <View style={{ gap: espacio.m }}>
            <Titulo>Contactos</Titulo>
            <TextInput
              value={q}
              onChangeText={hacerBuscar}
              placeholder="Buscar por nombre o teléfono"
              style={{ borderWidth: 1, borderColor: colores.borde, padding: 14, borderRadius: 12 }}
            />
            {recibidas.length > 0 && (
              <>
                <Titulo nivel={3}>Solicitudes</Titulo>
                {recibidas.map((x) => (
                  <Fila key={x.user_id} x={x}>
                    <Boton variante="marca" onPress={() => accion(() => responder(x.contact_id, true))}>
                      Aceptar
                    </Boton>
                    <Boton variante="secundario" onPress={() => accion(() => responder(x.contact_id, false))}>
                      Rechazar
                    </Boton>
                  </Fila>
                ))}
              </>
            )}{' '}
            {resultados.map((x) => (
              <Fila key={x.user_id} x={x}>
                {x.estado ? (
                  <Texto suave>{x.estado === 'aceptado' ? 'Contacto' : 'Pendiente'}</Texto>
                ) : (
                  <Boton onPress={() => accion(() => solicitar(x.user_id))}>Agregar</Boton>
                )}
              </Fila>
            ))}
            <Titulo nivel={3}>Mis contactos</Titulo>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/persona/[id]', params: { id: item.user_id } })}>
            <Fila x={item}>
              <Texto suave>Contacto</Texto>
            </Fila>
          </Pressable>
        )}
      />
    </RequiereLogin>
  )
}
function Fila({ x, children }: { x: { full_name: string; avatar_url: string | null }; children: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <Avatar nombre={x.full_name} url={x.avatar_url} tam={42} />
      <Texto style={{ flex: 1 }}>{x.full_name}</Texto>
      {children}
    </View>
  )
}
