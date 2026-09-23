import { router, useFocusEffect } from 'expo-router'
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  FileText,
  LogOut,
  Pencil,
  Shield,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar } from '../../components/Avatar'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { fecha, useCategorias } from '../../lib/datos'
import { borrarMisArchivos } from '../../lib/imagenes'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, fuentes, radio } from '../../theme'

type MiPrestador = {
  status: 'pendiente' | 'aprobado' | 'suspendido'
  is_active: boolean
  categorias: number[]
  trabajos_realizados: number
  contactos_recibidos: number
  calificacion: number | null
  cant_resenas: number
}

const ESTADO: Record<MiPrestador['status'], { texto: string; detalle: string; fondo: string; tinta: string }> = {
  pendiente: {
    texto: 'En revisión',
    detalle: 'Estamos revisando tus servicios. Te avisamos cuando estés en el catálogo.',
    fondo: '#FFF1E5',
    tinta: '#9A3412',
  },
  aprobado: { texto: 'Aprobado', detalle: 'Tus servicios están visibles para los vecinos.', fondo: '#ECFDF5', tinta: '#047857' },
  suspendido: {
    texto: 'Suspendido',
    detalle: 'Tu perfil de prestador está suspendido. Escribinos a soporte para revisarlo.',
    fondo: '#FEF2F2',
    tinta: '#B91C1C',
  },
}

function Opcion({ icono: Icono, texto, onPress }: { icono: LucideIcon; texto: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => Alert.alert('Próximamente', 'Esta sección va a estar lista antes del lanzamiento.'))}
      style={({ pressed }) => [estilos.opcion, pressed && { backgroundColor: colores.grupo }]}
    >
      <Icono size={22} color={colores.tinta} />
      <Texto style={{ flex: 1 }}>{texto}</Texto>
      <ChevronRight size={20} color={colores.texto2} />
    </Pressable>
  )
}

export default function Perfil() {
  const { sesion, perfil } = useSesion()
  const categorias = useCategorias()
  const yo = sesion?.user.id
  const [prestador, setPrestador] = useState<MiPrestador | null | undefined>(undefined)
  const [borrando, setBorrando] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!yo) return
      supabase.rpc('perfil_prestador', { p_user: yo }).then(async ({ data }) => {
        if (!data) return setPrestador(null)
        const { data: pp } = await supabase.from('provider_profiles').select('is_active').eq('user_id', yo).single()
        setPrestador({ ...(data as MiPrestador), is_active: pp?.is_active ?? true })
      })
    }, [yo]),
  )

  function eliminarCuenta() {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borran tu perfil, tus pedidos, tus chats y tus servicios. Tus reseñas quedan como "Usuario eliminado". No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBorrando(true)
            // Primero las fotos: despues de borrar la cuenta ya no hay permiso.
            await borrarMisArchivos(yo!).catch(() => {})
            const { error } = await supabase.rpc('borrar_mi_cuenta')
            setBorrando(false)
            if (error) return Alert.alert('No pudimos eliminar la cuenta', 'Probá de nuevo en un rato.')
            await supabase.auth.signOut()
          },
        },
      ],
    )
  }

  return (
    <RequiereLogin
      icono={UserRound}
      titulo="Tu cuenta de CercaYa"
      texto="Entrá para publicar pedidos, chatear con vecinos y ofrecer tus servicios."
    >
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/editar-perfil')} style={estilos.cabecera}>
          <Avatar nombre={perfil?.full_name ?? ''} url={perfil?.avatar_url} tam={64} />
          <View style={{ flex: 1 }}>
            <Titulo nivel={2}>{perfil?.full_name}</Titulo>
            {perfil && <Texto suave>En CercaYa desde {fecha(perfil.created_at)}</Texto>}
          </View>
          <Pencil size={20} color={colores.texto2} />
        </Pressable>

        {prestador === undefined ? null : prestador === null ? (
          <View style={estilos.servicios}>
            <BriefcaseBusiness size={28} color={colores.naranjaOscuro} />
            <Titulo nivel={3}>Ofrecés algún oficio en Ramallo?</Titulo>
            <Texto suave>Sumá tus servicios gratis y recibí consultas de vecinos de tu zona.</Texto>
            <Boton variante="marca" onPress={() => router.push('/mis-servicios')}>
              Sumar mis servicios
            </Boton>
          </View>
        ) : (
          <View style={estilos.misServicios}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Titulo nivel={3}>Mis servicios</Titulo>
              <View style={[estilos.badge, { backgroundColor: ESTADO[prestador.status].fondo }]}>
                <Texto style={[estilos.badgeTexto, { color: ESTADO[prestador.status].tinta }]}>
                  {prestador.status === 'aprobado' && !prestador.is_active ? 'Pausado' : ESTADO[prestador.status].texto}
                </Texto>
              </View>
            </View>
            <Texto suave style={{ fontSize: 14 }}>
              {prestador.status === 'aprobado' && !prestador.is_active
                ? 'No aparecés en el catálogo hasta que vuelvas a activarte.'
                : ESTADO[prestador.status].detalle}
            </Texto>
            <Texto fuerte style={{ fontSize: 14 }}>
              {prestador.categorias.map((id) => categorias.find((c) => c.id === id)?.name).filter(Boolean).join(' · ')}
            </Texto>
            {prestador.status === 'aprobado' && (
              <View style={estilos.metricas}>
                <Metrica valor={String(prestador.contactos_recibidos)} etiqueta="Contactos" />
                <Metrica valor={String(prestador.trabajos_realizados)} etiqueta="Trabajos" />
                <Metrica
                  valor={prestador.calificacion != null ? `★ ${Number(prestador.calificacion).toLocaleString('es-AR')}` : '—'}
                  etiqueta={`${prestador.cant_resenas} reseñas`}
                />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: espacio.s }}>
              <Boton variante="secundario" onPress={() => router.push('/mis-servicios')} style={{ flex: 1 }}>
                Editar
              </Boton>
              {prestador.status === 'aprobado' && (
                <Boton
                  variante="secundario"
                  onPress={() => router.push({ pathname: '/prestador/[id]', params: { id: yo! } })}
                  style={{ flex: 1 }}
                >
                  Ver como vecino
                </Boton>
              )}
            </View>
          </View>
        )}

        <View style={estilos.menu}>
          <Opcion icono={UserRound} texto="Mis datos" onPress={() => router.push('/editar-perfil')} />
          <Opcion icono={Shield} texto="Privacidad" onPress={() => router.push('/privacidad')} />
          <Opcion icono={Bell} texto="Notificaciones" onPress={() => router.push('/ajustes-notificaciones')} />
          {perfil?.is_admin && <Opcion icono={ShieldCheck} texto="Administración" onPress={() => router.push('/admin')} />}
          <Opcion icono={CircleHelp} texto="Ayuda y soporte" />
          <Opcion icono={FileText} texto="Términos y privacidad" />
          <Opcion icono={LogOut} texto="Cerrar sesión" onPress={() => supabase.auth.signOut()} />
        </View>

        <Boton variante="peligro" onPress={eliminarCuenta} cargando={borrando}>
          Eliminar mi cuenta
        </Boton>
      </ScrollView>
    </RequiereLogin>
  )
}

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={estilos.metrica}>
      <Titulo nivel={3}>{valor}</Titulo>
      <Texto suave style={{ fontSize: 12 }}>{etiqueta}</Texto>
    </View>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxl },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  servicios: { gap: espacio.s, padding: espacio.l, borderRadius: radio.l, backgroundColor: colores.naranjaSuave },
  misServicios: { gap: espacio.s, padding: espacio.l, borderRadius: radio.l, borderWidth: 1, borderColor: colores.borde },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radio.full },
  badgeTexto: { fontFamily: fuentes.textoFuerte, fontSize: 12 },
  metricas: { flexDirection: 'row', gap: espacio.s },
  metrica: { flex: 1, alignItems: 'center', paddingVertical: espacio.s, borderRadius: radio.m, backgroundColor: colores.grupo },
  menu: { borderRadius: radio.m, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: 54,
    paddingHorizontal: espacio.l,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
})
