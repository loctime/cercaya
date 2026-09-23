import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { ClipboardList, EllipsisVertical, Phone, SendHorizontal } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconoWhatsApp } from '../../components/IconoWhatsApp'
import { Boton, Texto } from '../../components/ui'
import { abrirWhatsApp } from '../../lib/contacto'
import { fecha } from '../../lib/datos'
import { bloquear } from '../../lib/moderacion'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, fuentes, radio } from '../../theme'

type Mensaje = {
  id: string
  sender_id: string | null
  kind: 'texto' | 'contacto' | 'sistema'
  body: string
  contact_phone: string | null
  created_at: string
  read_at: string | null
}

type Cabecera = {
  otroId: string
  otroNombre: string
  otroEsPrestador: boolean
  jobId: string | null
  jobTitulo: string | null
}

const CAMPOS = 'id, sender_id, kind, body, contact_phone, created_at, read_at'
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
const dia = (iso: string) => {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return fecha(iso)
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { sesion } = useSesion()
  const yo = sesion?.user.id ?? ''
  const insets = useSafeAreaInsets()
  const alturaHeader = useHeaderHeight()
  const [cab, setCab] = useState<Cabecera | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const input = useRef<TextInput>(null)

  // Agrega o reemplaza por id (llegan por la respuesta del insert y por tiempo real).
  const mezclar = useCallback((nuevos: Mensaje[]) => {
    setMensajes((prev) => {
      const porId = new Map((prev ?? []).map((m) => [m.id, m]))
      for (const m of nuevos) porId.set(m.id, m)
      return [...porId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
    })
  }, [])

  useEffect(() => {
    if (!yo) return
    ;(async () => {
      const { data: conv } = await supabase.from('conversations').select('job_id, user_a, user_b').eq('id', id).maybeSingle()
      if (!conv) {
        setMensajes([])
        return
      }
      const otroId = conv.user_a === yo ? conv.user_b : conv.user_a
      const [otro, prest, job, msjs] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', otroId).single(),
        supabase.from('provider_profiles').select('user_id').eq('user_id', otroId).maybeSingle(),
        conv.job_id ? supabase.from('jobs').select('title').eq('id', conv.job_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('messages').select(CAMPOS).eq('conversation_id', id).order('created_at', { ascending: false }).limit(200),
      ])
      setCab({
        otroId,
        otroNombre: otro.data?.full_name ?? 'Usuario',
        otroEsPrestador: !!prest.data,
        jobId: conv.job_id,
        jobTitulo: job.data?.title ?? null,
      })
      setMensajes((msjs.data as Mensaje[]) ?? [])
      supabase.rpc('marcar_leidos', { p_conv: id })
    })()

    // Tiempo real: mensajes nuevos y confirmaciones de lectura.
    const canal = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (cambio) => {
          const m = cambio.new as Mensaje
          if (!m?.id) return
          mezclar([m])
          if (cambio.eventType === 'INSERT' && m.sender_id && m.sender_id !== yo) {
            supabase.rpc('marcar_leidos', { p_conv: id })
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [id, yo, mezclar])

  async function enviar() {
    const cuerpo = texto.trim()
    if (!cuerpo) return
    setEnviando(true)
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: yo, body: cuerpo })
      .select(CAMPOS)
      .single()
    setEnviando(false)
    if (error) return Alert.alert('No se pudo enviar', error.message)
    setTexto('')
    mezclar([data as Mensaje])
  }

  async function compartirContacto() {
    if (!cab) return
    // Se lee en el momento: pudo haberlo cargado recien en "Mis datos".
    const { data: priv } = await supabase.from('profile_private').select('phone').eq('user_id', yo).single()
    const miTelefono = priv?.phone ?? null
    if (!miTelefono) {
      return Alert.alert('Falta tu celular', 'Cargá tu celular en tus datos para poder compartirlo.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cargar celular', onPress: () => router.push('/editar-perfil') },
      ])
    }
    Alert.alert(
      'Compartir mi contacto',
      `${cab.otroNombre.split(' ')[0]} va a ver tu número (${miTelefono}) y un botón para escribirte por WhatsApp.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Compartir',
          onPress: async () => {
            const { error } = await supabase.rpc('compartir_contacto', { p_conv: id })
            if (error) Alert.alert('No se pudo compartir', error.message)
          },
        },
      ],
    )
  }

  function menu() {
    if (!cab) return
    const opciones: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = []
    if (cab.otroEsPrestador) {
      opciones.push({ text: 'Ver perfil', onPress: () => router.push({ pathname: '/prestador/[id]', params: { id: cab.otroId } }) })
    }
    opciones.push(
      { text: 'Denunciar chat', onPress: () => router.push({ pathname: '/denunciar', params: { tipo: 'chat', id } }) },
      { text: 'Bloquear', style: 'destructive', onPress: () => bloquear(cab.otroId, cab.otroNombre, () => router.back()) },
      { text: 'Cancelar', style: 'cancel' },
    )
    Alert.alert(cab.otroNombre, undefined, opciones)
  }

  const ultimoMioLeido = mensajes?.find((m) => m.sender_id === yo)

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? alturaHeader : 0}
    >
      <Stack.Screen
        options={{
          title: cab?.otroNombre ?? '',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Más opciones" hitSlop={10} onPress={menu}>
              <EllipsisVertical size={22} color={colores.tinta} />
            </Pressable>
          ),
        }}
      />

      {cab?.jobId && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: cab.jobId! } })}
          style={estilos.pedido}
        >
          <ClipboardList size={18} color={colores.naranjaOscuro} />
          <Texto numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
            {cab.jobTitulo ?? 'Pedido'}
          </Texto>
          <Texto fuerte style={{ fontSize: 14, color: colores.naranjaOscuro }}>
            Ver pedido
          </Texto>
        </Pressable>
      )}

      {mensajes === null ? (
        <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} />
      ) : (
        <FlatList
          inverted
          data={mensajes}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: espacio.l, gap: espacio.xs }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], padding: espacio.xl }}>
              <Texto suave style={{ textAlign: 'center' }}>
                Escribí el primer mensaje. Tu número no se comparte salvo que vos lo decidas.
              </Texto>
            </View>
          }
          renderItem={({ item: m, index }) => {
            const anterior = mensajes[index + 1]
            const cambiaDia = !anterior || dia(anterior.created_at) !== dia(m.created_at)
            return (
              <View>
                {cambiaDia && <Texto style={estilos.dia}>{dia(m.created_at)}</Texto>}
                <Burbuja
                  m={m}
                  mio={m.sender_id === yo}
                  otroNombre={cab?.otroNombre ?? ''}
                  onWhatsApp={() =>
                    m.contact_phone && cab && abrirWhatsApp(cab.otroId, m.contact_phone, 'Hola, te escribo por CercaYa.')
                  }
                />
                {m.id === ultimoMioLeido?.id && m.read_at && <Texto style={estilos.leido}>Leído</Texto>}
              </View>
            )
          }}
        />
      )}

      <View style={[estilos.composer, { paddingBottom: insets.bottom + espacio.s }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartir mi contacto"
          onPress={compartirContacto}
          style={estilos.botonRedondo}
        >
          <Phone size={22} color={colores.naranjaOscuro} />
        </Pressable>
        <TextInput
          ref={input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribí un mensaje"
          placeholderTextColor={colores.texto2}
          multiline
          maxLength={2000}
          style={estilos.input}
          accessibilityLabel="Mensaje"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          onPress={enviar}
          disabled={!texto.trim() || enviando}
          style={[estilos.botonRedondo, estilos.enviar, (!texto.trim() || enviando) && { opacity: 0.4 }]}
        >
          {enviando ? <ActivityIndicator color={colores.tinta} /> : <SendHorizontal size={22} color={colores.tinta} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function Burbuja({ m, mio, otroNombre, onWhatsApp }: { m: Mensaje; mio: boolean; otroNombre: string; onWhatsApp: () => void }) {
  if (m.kind === 'sistema') {
    return (
      <View style={estilos.sistema}>
        <Texto suave style={{ fontSize: 13, textAlign: 'center' }}>
          {m.body} · {hora(m.created_at)}
        </Texto>
      </View>
    )
  }
  if (m.kind === 'contacto') {
    return (
      <View style={[estilos.burbuja, estilos.tarjetaContacto, mio ? estilos.mia : estilos.suya]}>
        <Texto fuerte>{mio ? 'Compartiste tu contacto' : `${otroNombre.split(' ')[0]} te compartió su WhatsApp`}</Texto>
        <Texto>{m.contact_phone}</Texto>
        {!mio && (
          <Boton variante="whatsapp" adorno={<IconoWhatsApp size={18} />} onPress={onWhatsApp}>
            Abrir en WhatsApp
          </Boton>
        )}
        <Texto suave style={estilos.horaBurbuja}>{hora(m.created_at)}</Texto>
      </View>
    )
  }
  return (
    <View style={[estilos.burbuja, mio ? estilos.mia : estilos.suya]}>
      <Texto selectable>{m.body}</Texto>
      <Texto suave style={estilos.horaBurbuja}>{hora(m.created_at)}</Texto>
    </View>
  )
}

const estilos = StyleSheet.create({
  pedido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    backgroundColor: colores.naranjaSuave,
  },
  dia: {
    alignSelf: 'center',
    marginVertical: espacio.s,
    fontSize: 12,
    fontFamily: fuentes.textoFuerte,
    color: colores.texto2,
  },
  burbuja: { maxWidth: '82%', paddingHorizontal: espacio.m, paddingVertical: espacio.s, borderRadius: radio.l, gap: 2 },
  mia: { alignSelf: 'flex-end', backgroundColor: colores.naranjaSuave, borderBottomRightRadius: 4 },
  suya: { alignSelf: 'flex-start', backgroundColor: colores.grupo, borderBottomLeftRadius: 4 },
  tarjetaContacto: { gap: espacio.s, paddingVertical: espacio.m, minWidth: 230 },
  horaBurbuja: { fontSize: 11, lineHeight: 14, alignSelf: 'flex-end' },
  sistema: {
    alignSelf: 'center',
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    marginVertical: espacio.xs,
    borderRadius: radio.full,
    backgroundColor: colores.grupo,
  },
  leido: { alignSelf: 'flex-end', fontSize: 11, color: colores.texto2, marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    paddingTop: espacio.s,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    backgroundColor: colores.fondo,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: espacio.m,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: colores.grupo,
    fontFamily: fuentes.texto,
    fontSize: 16,
    color: colores.tinta,
  },
  botonRedondo: { width: 44, height: 44, borderRadius: radio.full, alignItems: 'center', justifyContent: 'center' },
  enviar: { backgroundColor: colores.naranja },
})
