import { Bell } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Texto, Vacio } from '../components/ui'
import { fecha } from '../lib/datos'
import { supabase } from '../lib/supabase'
import { colores, espacio, fuentes } from '../theme'

type Aviso = { id: string; title: string; body: string; created_at: string; read_at: string | null }

function esHoy(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

export default function Notificaciones() {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)

  async function cargar() {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setAvisos(data ?? [])
  }

  useEffect(() => {
    cargar()
  }, [])

  async function marcarTodas() {
    await supabase.rpc('marcar_notificaciones_leidas')
    cargar()
  }

  const hayNoLeidas = avisos?.some((a) => !a.read_at)

  return (
    <FlatList
      data={avisos ?? []}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        hayNoLeidas ? (
          <Pressable accessibilityRole="button" onPress={marcarTodas} style={estilos.marcar}>
            <Texto style={{ fontFamily: fuentes.textoFuerte, color: colores.naranjaOscuro }}>
              Marcar todas como leídas
            </Texto>
          </Pressable>
        ) : null
      }
      renderItem={({ item, index }) => {
        const previo = avisos?.[index - 1]
        const grupo = esHoy(item.created_at) ? 'Hoy' : 'Anteriores'
        const grupoPrevio = previo ? (esHoy(previo.created_at) ? 'Hoy' : 'Anteriores') : null
        return (
          <View>
            {grupo !== grupoPrevio && (
              <Texto suave fuerte style={estilos.grupo}>
                {grupo}
              </Texto>
            )}
            <View style={[estilos.fila, !item.read_at && { backgroundColor: colores.naranjaSuave }]}>
              <Texto fuerte>{item.title}</Texto>
              <Texto>{item.body}</Texto>
              <Texto suave style={{ fontSize: 13 }}>{fecha(item.created_at)}</Texto>
            </View>
          </View>
        )
      }}
      ListEmptyComponent={
        avisos === null ? null : (
          <Vacio
            icono={Bell}
            titulo="No tenés notificaciones"
            texto="Acá te vamos a avisar las novedades de tus pedidos y tus mensajes."
          />
        )
      }
    />
  )
}

const estilos = StyleSheet.create({
  marcar: { alignSelf: 'flex-end', padding: espacio.l },
  grupo: { paddingHorizontal: espacio.l, paddingTop: espacio.m, paddingBottom: espacio.xs, fontSize: 13 },
  fila: {
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
})
