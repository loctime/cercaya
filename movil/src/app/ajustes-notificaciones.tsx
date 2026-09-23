import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { Chip } from '../components/Chip'
import { Texto } from '../components/ui'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { colores, espacio } from '../theme'

type Prefs = {
  pedidos_cerca: boolean
  pedidos_radio_km: number
  mensajes: boolean
  estado_pedidos: boolean
  resenas: boolean
}

const OPCIONES: { clave: keyof Omit<Prefs, 'pedidos_radio_km'>; titulo: string; detalle: string }[] = [
  { clave: 'pedidos_cerca', titulo: 'Pedidos nuevos cerca', detalle: 'De tus rubros, si ofrecés servicios.' },
  { clave: 'mensajes', titulo: 'Mensajes nuevos', detalle: 'Cuando alguien te escribe por el chat.' },
  { clave: 'estado_pedidos', titulo: 'Novedades de tus pedidos', detalle: 'Interesados, asignación, llegada, trabajo terminado.' },
  { clave: 'resenas', titulo: 'Reseñas', detalle: 'Cuando alguien te califica.' },
]

const RADIOS = [5, 10, 15, 30]

export default function AjustesNotificaciones() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id ?? ''
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  useEffect(() => {
    supabase
      .from('notification_prefs')
      .select('pedidos_cerca, pedidos_radio_km, mensajes, estado_pedidos, resenas')
      .eq('user_id', yo)
      .single()
      .then(({ data }) => setPrefs(data as Prefs))
  }, [yo])

  async function cambiar(parcial: Partial<Prefs>) {
    const anterior = prefs
    setPrefs((p) => (p ? { ...p, ...parcial } : p))
    const { error } = await supabase.from('notification_prefs').update(parcial).eq('user_id', yo)
    if (error) {
      setPrefs(anterior)
      Alert.alert('No se pudo guardar', 'Probá de nuevo en un rato.')
    }
  }

  if (!prefs) return <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} />

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      {OPCIONES.map((o) => (
        <View key={o.clave} style={{ gap: espacio.s }}>
          <View style={estilos.fila}>
            <View style={{ flex: 1 }}>
              <Texto fuerte>{o.titulo}</Texto>
              <Texto suave style={{ fontSize: 13 }}>{o.detalle}</Texto>
            </View>
            <Switch
              value={prefs[o.clave]}
              onValueChange={(v) => cambiar({ [o.clave]: v })}
              trackColor={{ true: colores.naranja, false: colores.borde }}
              thumbColor={colores.fondo}
              accessibilityLabel={o.titulo}
            />
          </View>
          {o.clave === 'pedidos_cerca' && prefs.pedidos_cerca && (
            <View style={estilos.chips}>
              <Texto suave style={{ fontSize: 13, width: '100%' }}>Avisarme de pedidos a menos de:</Texto>
              {RADIOS.map((km) => (
                <Chip key={km} activo={prefs.pedidos_radio_km === km} onPress={() => cambiar({ pedidos_radio_km: km })}>
                  {`${km} km`}
                </Chip>
              ))}
            </View>
          )}
        </View>
      ))}
      <Texto suave style={{ fontSize: 13 }}>
        Además de estos avisos, siempre ves todo en la campanita de arriba.
      </Texto>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.xl },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
})
