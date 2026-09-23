import { Bell, BriefcaseBusiness, ChevronRight, CircleHelp, FileText, LogOut, Shield, UserRound } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { fecha } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, fuentes, radio } from '../../theme'

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

function Opcion({ icono: Icono, texto, onPress }: { icono: LucideIcon; texto: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => Alert.alert('Próximamente', 'Esta sección llega en las próximas etapas.'))}
      style={({ pressed }) => [estilos.opcion, pressed && { backgroundColor: colores.grupo }]}
    >
      <Icono size={22} color={colores.tinta} />
      <Texto style={{ flex: 1 }}>{texto}</Texto>
      <ChevronRight size={20} color={colores.texto2} />
    </Pressable>
  )
}

export default function Perfil() {
  const { perfil } = useSesion()
  const [borrando, setBorrando] = useState(false)

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
        <View style={estilos.cabecera}>
          <View style={estilos.avatar}>
            <Texto style={estilos.avatarTexto}>{iniciales(perfil?.full_name ?? '')}</Texto>
          </View>
          <View style={{ flex: 1 }}>
            <Titulo nivel={2}>{perfil?.full_name}</Titulo>
            {perfil && <Texto suave>En CercaYa desde {fecha(perfil.created_at)}</Texto>}
          </View>
        </View>

        <View style={estilos.servicios}>
          <BriefcaseBusiness size={28} color={colores.naranjaOscuro} />
          <Titulo nivel={3}>Ofrecés algún oficio en Ramallo?</Titulo>
          <Texto suave>Sumá tus servicios gratis y recibí consultas de vecinos de tu zona.</Texto>
          <Boton variante="marca" onPress={() => Alert.alert('Próximamente', 'El alta de servicios llega en la etapa 5.')}>
            Sumar mis servicios
          </Boton>
        </View>

        <View style={estilos.menu}>
          <Opcion icono={Shield} texto="Privacidad" />
          <Opcion icono={Bell} texto="Notificaciones" />
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

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxl },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { fontFamily: fuentes.titulo, fontSize: 22, color: colores.tinta },
  servicios: { gap: espacio.s, padding: espacio.l, borderRadius: radio.l, backgroundColor: colores.naranjaSuave },
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
