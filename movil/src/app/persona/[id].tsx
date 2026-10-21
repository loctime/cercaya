import { router, useLocalSearchParams } from 'expo-router'
import { UserRound } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar } from '../../components/Avatar'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { quitar, solicitar } from '../../lib/contactos'
import { misEncuentros, pedirEncuentro } from '../../lib/encuentros'
import { bloquear } from '../../lib/moderacion'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio } from '../../theme'

type Perfil = {
  user_id: string
  full_name: string
  avatar_url: string | null
  zone_label: string | null
  estado: 'aceptado' | 'enviada' | 'recibida' | null
}
type Experiencia = {
  id: string
  titulo: string
  lugar: string | null
  desde_anio: number
  hasta_anio: number | null
  descripcion: string | null
}
type Oficio = { label: string }

// Perfil de otra persona. El curriculum y los oficios los ve solo quien es
// contacto aceptado (lo decide la base, no la app).
export default function Persona() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { sesion } = useSesion()
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [experiencias, setExperiencias] = useState<Experiencia[]>([])
  const [oficios, setOficios] = useState<Oficio[]>([])

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('perfil_social', { p_user: id })
    const fila = ((data ?? []) as Perfil[])[0] ?? null
    setPerfil(fila)
    if (!fila) return
    const [cv, of] = await Promise.all([
      supabase
        .from('cv_entries')
        .select('id, titulo, lugar, desde_anio, hasta_anio, descripcion')
        .eq('user_id', id)
        .order('desde_anio', { ascending: false }),
      supabase.from('oficios').select('label').eq('user_id', id).order('label'),
    ])
    setExperiencias((cv.data as Experiencia[]) ?? [])
    setOficios((of.data as Oficio[]) ?? [])
  }, [id])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  async function agregar() {
    try {
      await solicitar(id)
      cargar()
    } catch (e: any) {
      Alert.alert('No se pudo agregar', e.message)
    }
  }

  function confirmarQuitar() {
    Alert.alert('Quitar contacto', 'Dejan de verse en el mapa y de ver el currículum del otro.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await quitar(id)
          cargar()
        },
      },
    ])
  }

  function masOpciones() {
    Alert.alert(perfil?.full_name ?? 'Perfil', undefined, [
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () => bloquear(id, perfil?.full_name ?? '', () => router.back()),
      },
      {
        text: 'Denunciar perfil',
        onPress: () => router.push({ pathname: '/denunciar', params: { tipo: 'perfil', id } }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const esYo = sesion?.user.id === id

  // Si ya hay un encuentro abierto con esta persona, el boton lo abre en vez de pedir otro.
  async function voyParaAlla() {
    try {
      const abiertos = await misEncuentros()
      const existente = abiertos.find((x) => x.otro_id === id)
      const encuentro = existente ? existente.id : await pedirEncuentro(id)
      router.push({ pathname: '/encuentro/[id]', params: { id: encuentro } })
    } catch (e: any) {
      Alert.alert('No se pudo pedir', e.message)
    }
  }
  const verCurriculum = esYo || perfil?.estado === 'aceptado'

  return (
    <RequiereLogin icono={UserRound} titulo="Perfil" texto="Entrá para ver perfiles de tus contactos.">
      <ScrollView contentContainerStyle={estilos.contenido}>
        {perfil === null && <Texto suave>No encontramos este perfil.</Texto>}
        {perfil && (
          <>
            <View style={estilos.cabecera}>
              <Avatar nombre={perfil.full_name} url={perfil.avatar_url} tam={64} />
              <View style={{ flex: 1 }}>
                <Titulo>{perfil.full_name}</Titulo>
                {perfil.zone_label && <Texto suave>{perfil.zone_label}</Texto>}
              </View>
            </View>

            {!esYo && perfil.estado === 'aceptado' && <Boton onPress={voyParaAlla}>Voy para allá</Boton>}
            {!esYo && perfil.estado === 'aceptado' && (
              <Boton variante="secundario" onPress={confirmarQuitar}>
                Quitar contacto
              </Boton>
            )}
            {!esYo && perfil.estado === null && <Boton onPress={agregar}>Agregar contacto</Boton>}
            {!esYo && perfil.estado === 'enviada' && <Boton deshabilitado>Solicitud enviada</Boton>}
            {!esYo && perfil.estado === 'recibida' && (
              <Texto suave>Esta persona te envió una solicitud. Respondela desde Contactos.</Texto>
            )}
            {!esYo && (
              <Boton variante="secundario" onPress={masOpciones}>
                Bloquear o denunciar
              </Boton>
            )}

            {verCurriculum ? (
              <>
                {oficios.length > 0 && (
                  <>
                    <Titulo nivel={2}>Oficios</Titulo>
                    <View style={estilos.etiquetas}>
                      {oficios.map((o) => (
                        <View key={o.label} style={estilos.etiqueta}>
                          <Texto>{o.label}</Texto>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                <Titulo nivel={2}>Currículum</Titulo>
                {experiencias.length === 0 && <Texto suave>Todavía no cargó experiencia.</Texto>}
                {experiencias.map((x) => (
                  <View key={x.id} style={{ gap: 2 }}>
                    <Texto fuerte>{x.titulo}</Texto>
                    <Texto suave>
                      {[x.lugar, x.hasta_anio ? `${x.desde_anio} – ${x.hasta_anio}` : `desde ${x.desde_anio}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Texto>
                    {x.descripcion && <Texto>{x.descripcion}</Texto>}
                  </View>
                ))}
              </>
            ) : (
              <Texto suave>El currículum y los oficios se ven cuando son contactos.</Texto>
            )}
          </>
        )}
      </ScrollView>
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  cabecera: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  etiqueta: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
})
