import { useCallback, useState } from 'react'
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Users } from 'lucide-react-native'
import { AvisoEncuentro } from '../../components/AvisoEncuentro'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { Avatar } from '../../components/Avatar'
import {
  buscar,
  cargarContactos,
  personasCerca,
  responder,
  solicitar,
  type Contacto,
  type PersonaCerca,
  type ResultadoBusqueda,
} from '../../lib/contactos'
import { textoDistancia } from '../../lib/datos'
import { colores, espacio } from '../../theme'
export default function Contactos() {
  const [lista, setLista] = useState<Contacto[]>([]),
    [q, setQ] = useState(''),
    [resultados, setResultados] = useState<ResultadoBusqueda[]>([]),
    [mensaje, setMensaje] = useState(''),
    [cerca, setCerca] = useState<PersonaCerca[] | null>(null)
  const cargar = () => {
    personasCerca()
      .then(setCerca)
      .catch(() => setCerca([]))
    return cargarContactos()
      .then(setLista)
      .catch(() => {})
  }
  useFocusEffect(
    useCallback(() => {
      cargar()
    }, []),
  )
  async function hacerBuscar(t: string) {
    setQ(t)
    setMensaje('')
    if (t.trim().length < 3) return setResultados([])
    try {
      const r = await buscar(t)
      setResultados(r)
      if (r.length === 0) setMensaje('No encontramos a nadie con ese nombre o teléfono.')
    } catch (e: any) {
      setResultados([])
      setMensaje(`No pudimos buscar: ${e.message}`)
    }
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: espacio.l, gap: espacio.m }}
        data={aceptados}
        keyExtractor={(x) => x.user_id}
        ListHeaderComponent={
          <View style={{ gap: espacio.m }}>
            <AvisoEncuentro />
            <Titulo>Contactos</Titulo>
            <TextInput
              value={q}
              onChangeText={hacerBuscar}
              placeholder="Buscar por nombre o teléfono"
              placeholderTextColor={colores.texto2}
              style={{
                borderWidth: 1,
                borderColor: colores.borde,
                padding: 14,
                borderRadius: 12,
                color: colores.tinta,
              }}
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
            )}
            {mensaje !== '' && <Texto suave>{mensaje}</Texto>}
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
        ListFooterComponent={
          <View style={{ gap: espacio.m, marginTop: espacio.xl }}>
            <Titulo nivel={3}>Cerca tuyo</Titulo>
            {cerca === null && <Texto suave>Buscando gente cerca…</Texto>}
            {cerca?.length === 0 && (
              <Texto suave>
                Todavía no hay nadie cerca que haya elegido aparecer. Podés activar "Aparecer para gente cerca" en tu
                Perfil.
              </Texto>
            )}
            {cerca?.map((x) => (
              <Pressable
                key={x.user_id}
                onPress={() => router.push({ pathname: '/persona/[id]', params: { id: x.user_id } })}
              >
                <Fila x={x}>
                  {x.estado ? (
                    <Texto suave>{x.estado === 'enviada' ? 'Pendiente' : 'Te agregó'}</Texto>
                  ) : (
                    <Boton onPress={() => accion(() => solicitar(x.user_id))}>Agregar</Boton>
                  )}
                </Fila>
                <Texto suave style={{ fontSize: 14, marginLeft: 52, marginTop: -4 }}>
                  {[x.zona, textoDistancia(x.distancia_km), x.oficios.join(', ')].filter(Boolean).join(' · ')}
                </Texto>
              </Pressable>
            ))}
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
