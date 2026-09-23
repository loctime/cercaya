import { router, Stack, useLocalSearchParams } from 'expo-router'
import { BadgeCheck, EllipsisVertical, ImageOff, MessageCircle, MessageSquareText, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../../components/Avatar'
import { Calificacion, Estrellas } from '../../components/Estrellas'
import { IconoWhatsApp } from '../../components/IconoWhatsApp'
import { Boton, Texto, Titulo } from '../../components/ui'
import { abrirChat, abrirWhatsApp, consultarContacto, mensajeInicial } from '../../lib/contacto'
import { fecha, textoDistancia, useCategorias } from '../../lib/datos'
import { bloquear } from '../../lib/moderacion'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, fuentes, radio } from '../../theme'

type Ficha = {
  user_id: string
  full_name: string
  avatar_url: string | null
  zone_label: string | null
  bio: string | null
  price_range: string | null
  categorias: number[]
  distancia_km: number | null
  calificacion: number | null
  cant_resenas: number
  trabajos_realizados: number
  contacto: 'whatsapp' | 'chat'
}

type Foto = { id: string; url: string; caption: string | null }
type Resena = {
  id: string
  rating: number
  comment: string | null
  trabajo_verificado: boolean
  created_at: string
  reviewer: { full_name: string } | null
}

const MOTIVOS: Record<string, string> = {
  lejos: 'Este prestador solo comparte su número con vecinos cercanos. Escribile por el chat de CercaYa.',
  sin_ubicacion: 'Para ver números de WhatsApp necesitamos tu zona. Mientras tanto, escribile por el chat.',
  oculto: 'Este prestador prefiere que le escriban por el chat de CercaYa.',
  sin_telefono: 'Este prestador no cargó su número. Escribile por el chat de CercaYa.',
  limite: 'Llegaste al límite de números por hoy. Escribile por el chat de CercaYa.',
  bloqueado: 'No podés contactar a este usuario.',
}

export default function FichaPrestador() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { sesion } = useSesion()
  const { origen } = useUbicacion()
  const categorias = useCategorias()
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [fotoAbierta, setFotoAbierta] = useState<Foto | null>(null)
  const [ocupado, setOcupado] = useState<'' | 'whatsapp' | 'chat'>('')

  useEffect(() => {
    supabase.rpc('perfil_prestador', { p_user: id, p_lat: origen.lat, p_lng: origen.lng }).then(({ data }) => {
      setFicha((data as Ficha) ?? null)
    })
    supabase
      .from('provider_photos')
      .select('id, storage_path, caption')
      .eq('user_id', id)
      .order('position')
      .then(({ data }) =>
        setFotos(
          (data ?? []).map((f) => ({
            id: f.id,
            caption: f.caption,
            url: supabase.storage.from('galeria').getPublicUrl(f.storage_path).data.publicUrl,
          })),
        ),
      )
    supabase
      .from('reviews')
      .select('id, rating, comment, trabajo_verificado, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)')
      .eq('reviewee_id', id)
      .eq('rol_calificado', 'prestador')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setResenas((data as unknown as Resena[]) ?? []))
    if (sesion) supabase.rpc('registrar_evento', { p_target: id, p_kind: 'ver_perfil' })
  }, [id, origen.lat, origen.lng, sesion])

  const rubros = (ficha?.categorias ?? []).map((cid) => categorias.find((c) => c.id === cid)).filter(Boolean)

  function menu() {
    if (!sesion) return router.push('/login')
    Alert.alert(ficha?.full_name ?? '', undefined, [
      { text: 'Denunciar perfil', onPress: () => router.push({ pathname: '/denunciar', params: { tipo: 'perfil', id } }) },
      {
        text: 'Bloquear usuario',
        style: 'destructive',
        onPress: () => bloquear(id, ficha?.full_name ?? 'este usuario', () => router.back()),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  async function chat() {
    if (!sesion) return router.push('/login')
    setOcupado('chat')
    await abrirChat(id)
    setOcupado('')
  }

  async function whatsapp() {
    if (!sesion) return router.push('/login')
    setOcupado('whatsapp')
    const r = await consultarContacto(id)
    setOcupado('')
    if (r.ok) {
      await abrirWhatsApp(id, r.telefono, mensajeInicial(ficha!.full_name, rubros[0]?.name))
    } else {
      Alert.alert('WhatsApp no disponible', MOTIVOS[r.motivo] ?? MOTIVOS.oculto, [
        { text: 'Cancelar', style: 'cancel' },
        ...(r.motivo === 'bloqueado' ? [] : [{ text: 'Abrir chat', onPress: chat }]),
      ])
    }
  }

  const header = (
    <Stack.Screen
      options={{
        title: '',
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Más opciones" hitSlop={10} onPress={menu}>
            <EllipsisVertical size={22} color={colores.tinta} />
          </Pressable>
        ),
      }}
    />
  )

  if (ficha === undefined) {
    return (
      <View style={estilos.centro}>
        {header}
        <ActivityIndicator color={colores.naranjaOscuro} />
      </View>
    )
  }
  if (ficha === null) {
    return (
      <View style={[estilos.centro, { padding: espacio.xl }]}>
        {header}
        <Texto style={{ textAlign: 'center' }}>Este perfil no está disponible.</Texto>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: espacio.l, gap: espacio.xl, paddingBottom: 140 }}>
        <View style={{ alignItems: 'center', gap: espacio.s }}>
          <Avatar nombre={ficha.full_name} url={ficha.avatar_url} tam={96} />
          <Titulo style={{ textAlign: 'center' }}>{ficha.full_name}</Titulo>
          <Texto suave style={{ textAlign: 'center' }}>
            {rubros.map((r) => r!.name).join(' · ')}
          </Texto>
          <Texto suave>
            {[ficha.zone_label, ficha.distancia_km != null ? `${textoDistancia(ficha.distancia_km)} de vos` : null]
              .filter(Boolean)
              .join(', ')}
          </Texto>
        </View>

        <View style={estilos.metricas}>
          <Metrica valor={String(ficha.trabajos_realizados)} etiqueta="Trabajos realizados" />
          <Metrica
            valor={ficha.calificacion != null ? `★ ${Number(ficha.calificacion).toLocaleString('es-AR')}` : '—'}
            etiqueta={`${ficha.cant_resenas} ${ficha.cant_resenas === 1 ? 'reseña' : 'reseñas'}`}
          />
        </View>

        {(ficha.bio || ficha.price_range) && (
          <View style={{ gap: espacio.s }}>
            <Titulo nivel={3}>Sobre su trabajo</Titulo>
            {ficha.bio ? <Texto>{ficha.bio}</Texto> : null}
            {ficha.price_range ? (
              <Texto>
                <Texto fuerte>Precios: </Texto>
                {ficha.price_range}
              </Texto>
            ) : null}
          </View>
        )}

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={3}>Trabajos anteriores</Titulo>
          {fotos.length === 0 ? (
            <View style={estilos.vacioChico}>
              <ImageOff size={20} color={colores.texto2} />
              <Texto suave style={{ flex: 1 }}>Este prestador todavía no subió fotos de sus trabajos.</Texto>
            </View>
          ) : (
            <View style={estilos.galeria}>
              {fotos.map((f) => (
                <Pressable key={f.id} accessibilityRole="imagebutton" onPress={() => setFotoAbierta(f)} style={estilos.foto}>
                  <Image source={{ uri: f.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={3}>Reseñas</Titulo>
          <Calificacion promedio={ficha.calificacion} cantidad={ficha.cant_resenas} />
          {resenas.length === 0 ? (
            <View style={estilos.vacioChico}>
              <MessageSquareText size={20} color={colores.texto2} />
              <Texto suave style={{ flex: 1 }}>
                Aún no tiene reseñas. Vas a poder calificarlo cuando termine un trabajo acordado por CercaYa.
              </Texto>
            </View>
          ) : (
            resenas.map((r) => (
              <View key={r.id} style={estilos.resena}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Texto fuerte>{r.reviewer?.full_name ?? 'Usuario eliminado'}</Texto>
                  <Texto suave style={{ fontSize: 14 }}>{fecha(r.created_at)}</Texto>
                </View>
                <Estrellas valor={r.rating} />
                {r.comment ? <Texto>{r.comment}</Texto> : null}
                {r.trabajo_verificado && (
                  <View style={estilos.verificado}>
                    <BadgeCheck size={16} color={colores.exito} />
                    <Texto style={{ fontSize: 14, color: colores.exito, fontFamily: fuentes.textoFuerte }}>
                      Trabajo verificado
                    </Texto>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[estilos.barra, { paddingBottom: insets.bottom + espacio.m }]}>
        {!sesion ? (
          <Boton onPress={() => router.push('/login')} style={{ flex: 1 }}>
            Contactar
          </Boton>
        ) : ficha.contacto === 'whatsapp' ? (
          <View style={{ flex: 1, gap: espacio.xs }}>
            <Boton
              variante="whatsapp"
              adorno={<IconoWhatsApp size={20} />}
              onPress={whatsapp}
              cargando={ocupado === 'whatsapp'}
            >
              Contactar por WhatsApp
            </Boton>
            <Pressable accessibilityRole="button" onPress={chat} disabled={!!ocupado} hitSlop={6} style={estilos.linkChat}>
              {ocupado === 'chat' ? (
                <ActivityIndicator color={colores.naranjaOscuro} />
              ) : (
                <Texto style={estilos.linkChatTexto}>o escribile por el chat de CercaYa</Texto>
              )}
            </Pressable>
          </View>
        ) : (
          <Boton icono={MessageCircle} onPress={chat} cargando={ocupado === 'chat'} style={{ flex: 1 }}>
            Enviar mensaje
          </Boton>
        )}
      </View>

      <Modal visible={!!fotoAbierta} transparent animationType="fade" onRequestClose={() => setFotoAbierta(null)}>
        <View style={estilos.visor}>
          <Pressable
            accessibilityLabel="Cerrar"
            onPress={() => setFotoAbierta(null)}
            style={[estilos.cerrarVisor, { top: insets.top + espacio.m }]}
          >
            <X size={28} color={colores.blanco} />
          </Pressable>
          {fotoAbierta && (
            <>
              <Image source={{ uri: fotoAbierta.url }} style={{ width: '100%', height: '75%' }} resizeMode="contain" />
              {fotoAbierta.caption ? (
                <Texto style={{ color: colores.blanco, textAlign: 'center', padding: espacio.l }}>{fotoAbierta.caption}</Texto>
              ) : null}
            </>
          )}
        </View>
      </Modal>
    </View>
  )
}

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={estilos.metrica}>
      <Titulo nivel={2}>{valor}</Titulo>
      <Texto suave style={{ fontSize: 14, textAlign: 'center', lineHeight: 18 }}>
        {etiqueta}
      </Texto>
    </View>
  )
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  metricas: { flexDirection: 'row', gap: espacio.s },
  metrica: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.xs,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
  },
  vacioChico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.l,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
  },
  galeria: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  foto: { width: '31.5%', aspectRatio: 1, borderRadius: radio.s, overflow: 'hidden', backgroundColor: colores.grupo },
  resena: { gap: espacio.xs, paddingVertical: espacio.m, borderBottomWidth: 1, borderBottomColor: colores.borde },
  verificado: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingTop: espacio.m,
    backgroundColor: colores.fondo,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  linkChat: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  linkChatTexto: { fontSize: 15, color: colores.naranjaOscuro, textDecorationLine: 'underline' },
  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  cerrarVisor: { position: 'absolute', right: espacio.l, zIndex: 1, padding: espacio.s },
})
