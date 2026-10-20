import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { X } from 'lucide-react-native'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { useCategorias } from '../lib/datos'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { colores, espacio } from '../theme'

type Experiencia = { id: string; titulo: string; lugar: string | null; desde_anio: number; hasta_anio: number | null }
type Oficio = { label: string; category_id: number | null }

// Curriculum y oficios propios. Los ven solo los contactos aceptados.
export default function EditarCurriculum() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id
  const categorias = useCategorias()
  const [experiencias, setExperiencias] = useState<Experiencia[]>([])
  const [oficios, setOficios] = useState<Oficio[]>([])
  const [titulo, setTitulo] = useState('')
  const [lugar, setLugar] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [oficioPropio, setOficioPropio] = useState('')

  const cargar = useCallback(async () => {
    if (!yo) return
    const [cv, of] = await Promise.all([
      supabase
        .from('cv_entries')
        .select('id, titulo, lugar, desde_anio, hasta_anio')
        .eq('user_id', yo)
        .order('desde_anio', { ascending: false }),
      supabase.from('oficios').select('label, category_id').eq('user_id', yo).order('label'),
    ])
    setExperiencias((cv.data as Experiencia[]) ?? [])
    setOficios((of.data as Oficio[]) ?? [])
  }, [yo])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  function error(e: { message: string } | null) {
    if (!e) return false
    Alert.alert('No se pudo guardar', e.message)
    return true
  }

  async function agregarExperiencia() {
    const anioDesde = Number(desde)
    const anioHasta = hasta.trim() ? Number(hasta) : null
    if (!titulo.trim() || !Number.isInteger(anioDesde)) {
      Alert.alert('Faltan datos', 'Poné qué hiciste y desde qué año.')
      return
    }
    const { error: e } = await supabase.from('cv_entries').insert({
      user_id: yo,
      titulo: titulo.trim(),
      lugar: lugar.trim() || null,
      desde_anio: anioDesde,
      hasta_anio: anioHasta,
      descripcion: descripcion.trim() || null,
    })
    if (error(e)) return
    setTitulo('')
    setLugar('')
    setDesde('')
    setHasta('')
    setDescripcion('')
    cargar()
  }

  async function borrarExperiencia(id: string) {
    await supabase.from('cv_entries').delete().eq('id', id)
    cargar()
  }

  async function agregarOficio(label: string, categoryId: number | null) {
    const { error: e } = await supabase.from('oficios').insert({ user_id: yo, label, category_id: categoryId })
    if (error(e)) return
    setOficioPropio('')
    cargar()
  }

  async function quitarOficio(label: string) {
    await supabase.from('oficios').delete().eq('user_id', yo).eq('label', label)
    cargar()
  }

  const sugeridas = categorias.filter((c) => !oficios.some((o) => o.label === c.name))

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Titulo nivel={2}>Mis oficios</Titulo>
      <View style={estilos.etiquetas}>
        {oficios.map((o) => (
          <Pressable key={o.label} onPress={() => quitarOficio(o.label)} style={estilos.oficio} accessibilityLabel={`Quitar ${o.label}`}>
            <Texto>{o.label}</Texto>
            <X size={14} color={colores.texto2} />
          </Pressable>
        ))}
      </View>
      {sugeridas.length > 0 && <Texto suave>Tocá uno para sumarlo:</Texto>}
      <View style={estilos.etiquetas}>
        {sugeridas.map((c) => (
          <Chip key={c.id} activo={false} onPress={() => agregarOficio(c.name, c.id)}>
            {c.name}
          </Chip>
        ))}
      </View>
      <Campo etiqueta="O escribí uno propio" value={oficioPropio} onChangeText={setOficioPropio} maxLength={40} />
      <Boton variante="secundario" deshabilitado={oficioPropio.trim().length < 2} onPress={() => agregarOficio(oficioPropio.trim(), null)}>
        Agregar oficio
      </Boton>

      <Titulo nivel={2}>Mi currículum</Titulo>
      {experiencias.map((x) => (
        <View key={x.id} style={estilos.experiencia}>
          <View style={{ flex: 1 }}>
            <Texto fuerte>{x.titulo}</Texto>
            <Texto suave>
              {[x.lugar, x.hasta_anio ? `${x.desde_anio} – ${x.hasta_anio}` : `desde ${x.desde_anio}`].filter(Boolean).join(' · ')}
            </Texto>
          </View>
          <Pressable onPress={() => borrarExperiencia(x.id)} accessibilityLabel={`Borrar ${x.titulo}`}>
            <X size={20} color={colores.texto2} />
          </Pressable>
        </View>
      ))}
      <Campo etiqueta="Qué hiciste" value={titulo} onChangeText={setTitulo} maxLength={80} />
      <Campo etiqueta="Dónde (opcional)" value={lugar} onChangeText={setLugar} maxLength={80} />
      <View style={estilos.anios}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Desde (año)" value={desde} onChangeText={setDesde} keyboardType="number-pad" maxLength={4} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Hasta (año, opcional)" value={hasta} onChangeText={setHasta} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>
      <Campo etiqueta="Contanos más (opcional)" value={descripcion} onChangeText={setDescripcion} maxLength={500} multiline />
      <Boton onPress={agregarExperiencia}>Agregar experiencia</Boton>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.m },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  oficio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  experiencia: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  anios: { flexDirection: 'row', gap: espacio.m },
})
