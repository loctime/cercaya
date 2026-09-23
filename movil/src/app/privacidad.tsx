import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { Texto, Titulo } from '../components/ui'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { colores, espacio, fuentes, radio } from '../theme'

type Privado = {
  phone: string | null
  show_phone: boolean
  phone_radius_km: number
  location_precision: 'barrio' | 'localidad'
}
type Bloqueado = { blocked_id: string; perfil: { full_name: string; avatar_url: string | null } | null }

const RADIOS = [15, 30, 50]

export default function Privacidad() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id ?? ''
  const [datos, setDatos] = useState<Privado | null>(null)
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([])

  const cargar = useCallback(async () => {
    const [priv, blq] = await Promise.all([
      supabase.from('profile_private').select('phone, show_phone, phone_radius_km, location_precision').eq('user_id', yo).single(),
      supabase.from('blocks').select('blocked_id, perfil:profiles!blocks_blocked_id_fkey(full_name, avatar_url)').eq('blocker_id', yo),
    ])
    setDatos(priv.data as Privado)
    setBloqueados((blq.data as unknown as Bloqueado[]) ?? [])
  }, [yo])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  // Guarda un cambio al toque, sin boton de guardar (como los ajustes del telefono).
  async function cambiar(parcial: Partial<Privado>) {
    const anterior = datos
    setDatos((d) => (d ? { ...d, ...parcial } : d))
    const { error } = await supabase.from('profile_private').update(parcial).eq('user_id', yo)
    if (error) {
      setDatos(anterior)
      Alert.alert('No se pudo guardar', 'Probá de nuevo en un rato.')
    }
  }

  function mostrarNumero(valor: boolean) {
    if (valor && !datos?.phone) {
      return Alert.alert('Falta tu celular', 'Primero cargá tu celular en "Mis datos".', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a mis datos', onPress: () => router.push('/editar-perfil') },
      ])
    }
    cambiar({ show_phone: valor })
  }

  function desbloquear(b: Bloqueado) {
    Alert.alert(`Desbloquear a ${b.perfil?.full_name ?? 'este usuario'}`, 'Va a poder volver a escribirte.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          await supabase.from('blocks').delete().eq('blocker_id', yo).eq('blocked_id', b.blocked_id)
          cargar()
        },
      },
    ])
  }

  if (!datos) return <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} />

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.seccion}>
        <Titulo nivel={3}>Tu número de teléfono</Titulo>
        <View style={estilos.fila}>
          <View style={{ flex: 1 }}>
            <Texto fuerte>Mostrar mi número</Texto>
            <Texto suave style={{ fontSize: 14 }}>{datos.phone ?? 'Sin celular cargado'}</Texto>
          </View>
          <Switch
            value={datos.show_phone}
            onValueChange={mostrarNumero}
            trackColor={{ true: colores.naranja, false: colores.borde }}
            thumbColor={colores.fondo}
            accessibilityLabel="Mostrar mi número"
          />
        </View>
        {!datos.show_phone ? (
          <View style={estilos.sugerencia}>
            <Texto style={{ fontSize: 14 }}>
              Los vecinos te contactan más rápido por WhatsApp. Si lo activás, tu número solo lo ven vecinos registrados y
              cercanos. Mientras tanto, te escriben por el chat de CercaYa.
            </Texto>
          </View>
        ) : (
          <View style={{ gap: espacio.s }}>
            <Texto fuerte style={{ fontSize: 14 }}>Quién puede verlo: vecinos registrados hasta</Texto>
            <View style={estilos.chips}>
              {RADIOS.map((km) => (
                <Chip key={km} activo={datos.phone_radius_km === km} onPress={() => cambiar({ phone_radius_km: km })}>
                  {`${km} km`}
                </Chip>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={estilos.seccion}>
        <Titulo nivel={3}>Tu ubicación</Titulo>
        <Texto suave style={{ fontSize: 14 }}>
          Nadie ve tu dirección ni tu ubicación exacta. Elegí cuánto mostrar en tu perfil:
        </Texto>
        <View style={estilos.chips}>
          <Chip activo={datos.location_precision === 'barrio'} onPress={() => cambiar({ location_precision: 'barrio' })}>
            Barrio aproximado
          </Chip>
          <Chip activo={datos.location_precision === 'localidad'} onPress={() => cambiar({ location_precision: 'localidad' })}>
            Solo la localidad
          </Chip>
        </View>
      </View>

      <View style={estilos.seccion}>
        <Titulo nivel={3}>Usuarios bloqueados</Titulo>
        {bloqueados.length === 0 ? (
          <Texto suave style={{ fontSize: 14 }}>No bloqueaste a nadie.</Texto>
        ) : (
          bloqueados.map((b) => (
            <View key={b.blocked_id} style={estilos.fila}>
              <Avatar nombre={b.perfil?.full_name ?? '?'} url={b.perfil?.avatar_url} tam={40} />
              <Texto style={{ flex: 1 }}>{b.perfil?.full_name ?? 'Usuario'}</Texto>
              <Pressable accessibilityRole="button" onPress={() => desbloquear(b)} hitSlop={8}>
                <Texto style={{ fontFamily: fuentes.textoFuerte, color: colores.naranjaOscuro }}>Desbloquear</Texto>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.xl },
  seccion: { gap: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  sugerencia: { padding: espacio.l, borderRadius: radio.m, backgroundColor: '#ECFDF5' },
})
