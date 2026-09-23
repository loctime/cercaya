import { router, useFocusEffect } from 'expo-router'
import { MessageCircle } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { Avatar } from '../../components/Avatar'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Texto, Vacio } from '../../components/ui'
import { fecha } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, fuentes, radio } from '../../theme'

type Chat = {
  id: string
  job_title: string | null
  otro_id: string
  otro_nombre: string
  otro_avatar: string | null
  ultimo_texto: string | null
  ultimo_kind: 'texto' | 'contacto' | 'sistema' | null
  ultimo_mio: boolean | null
  ultimo_at: string
  sin_leer: number
}

// Hoy: hora; antes: DD/MM/AAAA.
function cuando(iso: string) {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : fecha(iso)
}

function vistaPrevia(c: Chat) {
  if (!c.ultimo_texto) return 'Todavía no hay mensajes'
  if (c.ultimo_kind === 'contacto') return c.ultimo_mio ? 'Compartiste tu contacto' : 'Te compartió su contacto'
  return (c.ultimo_mio ? 'Vos: ' : '') + c.ultimo_texto
}

export default function Mensajes() {
  const { sesion } = useSesion()
  const [chats, setChats] = useState<Chat[] | null>(null)
  const [recargando, setRecargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!sesion) return
    const { data } = await supabase.rpc('mis_chats')
    setChats((data as Chat[]) ?? [])
  }, [sesion])

  useFocusEffect(
    useCallback(() => {
      cargar()
      if (!sesion) return
      // Si llega un mensaje con la lista abierta, se refresca sola.
      const canal = supabase
        .channel('lista-chats')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => cargar())
        .subscribe()
      return () => {
        supabase.removeChannel(canal)
      }
    }, [cargar, sesion]),
  )

  function opciones(c: Chat) {
    Alert.alert(c.otro_nombre, undefined, [
      {
        text: 'Eliminar chat',
        style: 'destructive',
        onPress: async () => {
          await supabase.rpc('ocultar_chat', { p_conv: c.id })
          cargar()
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  return (
    <RequiereLogin
      icono={MessageCircle}
      titulo="Hablá sin dar tu número"
      texto="Entrá para chatear con vecinos y prestadores. Tu teléfono solo lo ve quien vos elijas."
    >
      <FlatList
        style={{ backgroundColor: colores.fondo }}
        data={chats ?? []}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={async () => {
              setRecargando(true)
              await cargar()
              setRecargando(false)
            }}
          />
        }
        renderItem={({ item: c }) => {
          const noLeidos = Number(c.sin_leer)
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Mantené apretado para más opciones"
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
              onLongPress={() => opciones(c)}
              style={({ pressed }) => [estilos.fila, pressed && { backgroundColor: colores.grupo }]}
            >
              <Avatar nombre={c.otro_nombre} url={c.otro_avatar} tam={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={estilos.linea}>
                  <Texto style={estilos.nombre} numberOfLines={1}>
                    {c.otro_nombre}
                  </Texto>
                  <Texto suave style={[{ fontSize: 13 }, noLeidos > 0 && { color: colores.naranjaOscuro }]}>
                    {cuando(c.ultimo_at)}
                  </Texto>
                </View>
                {c.job_title ? (
                  <Texto suave numberOfLines={1} style={{ fontSize: 14 }}>
                    {c.job_title}
                  </Texto>
                ) : null}
                <View style={estilos.linea}>
                  <Texto
                    numberOfLines={1}
                    style={[{ flex: 1, fontSize: 14 }, noLeidos > 0 ? { fontFamily: fuentes.textoFuerte } : { color: colores.texto2 }]}
                  >
                    {vistaPrevia(c)}
                  </Texto>
                  {noLeidos > 0 && (
                    <View style={estilos.badge} accessibilityLabel={`${noLeidos} sin leer`}>
                      <Texto style={estilos.badgeTexto}>{noLeidos > 99 ? '99+' : noLeidos}</Texto>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={
          chats === null ? (
            <ActivityIndicator color={colores.naranjaOscuro} style={{ marginTop: espacio.xl }} />
          ) : (
            <Vacio
              icono={MessageCircle}
              titulo="No tenés conversaciones"
              texto="Cuando consultes a un prestador o alguien se interese en tu pedido, los chats aparecen acá."
            />
          )
        }
      />
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  linea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  nombre: { flex: 1, fontFamily: fuentes.tituloSuave, fontSize: 16 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontFamily: fuentes.textoFuerte, fontSize: 12, lineHeight: 16, color: colores.tinta },
})
