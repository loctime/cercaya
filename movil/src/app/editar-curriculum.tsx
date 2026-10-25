import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { X } from 'lucide-react-native'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { estoyDisponible, miDisponibilidad, yaNoDisponible } from '../lib/disponibilidad'
import { disponibleAhora, textoDisponibleHasta } from '../lib/trabajo'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { colores, espacio } from '../theme'

type Experiencia = { id: string; titulo: string; lugar: string | null; desde_anio: number; hasta_anio: number | null }
type Oficio = { label: string; category_id: number | null; tipo: 'oficio' | 'tarea'; catalog_id: string | null; acepta_pedidos: boolean }
type Habilidad = { id: string; label: string; category_id: number | null; tipo: 'oficio' | 'tarea' }

// Curriculum y oficios propios. Los ven solo los contactos aceptados.
export default function EditarCurriculum() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id
  const [experiencias, setExperiencias] = useState<Experiencia[]>([])
  const [oficios, setOficios] = useState<Oficio[]>([])
  const [habilidades, setHabilidades] = useState<Habilidad[]>([])
  const [titulo, setTitulo] = useState('')
  const [lugar, setLugar] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [oficioPropio, setOficioPropio] = useState('')
  const [ofrece, setOfrece] = useState(false)
  const [disponibleHasta, setDisponibleHasta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!yo) return
    const [cv, of, catalogo, priv] = await Promise.all([
      supabase
        .from('cv_entries')
        .select('id, titulo, lugar, desde_anio, hasta_anio')
        .eq('user_id', yo)
        .order('desde_anio', { ascending: false }),
      supabase.from('oficios').select('label, category_id, tipo, catalog_id, acepta_pedidos').eq('user_id', yo).order('label'),
      supabase.from('habilidades_catalogo').select('id, label, category_id, tipo').order('tipo').order('label'),
      supabase.from('profile_private').select('ofrece_servicios').eq('user_id', yo).maybeSingle(),
    ])
    setExperiencias((cv.data as Experiencia[]) ?? [])
    setOficios((of.data as Oficio[]) ?? [])
    setHabilidades((catalogo.data as Habilidad[]) ?? [])
    setOfrece(!!priv.data?.ofrece_servicios)
    miDisponibilidad(yo).then((d) => setDisponibleHasta(d.hasta))
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

  async function agregarOficio(label: string, categoryId: number | null, tipo: Oficio['tipo'] = 'oficio', catalogId: string | null = null) {
    const { error: e } = await supabase.from('oficios').insert({ user_id: yo, label, category_id: categoryId, tipo, catalog_id: catalogId })
    if (error(e)) return
    setOficioPropio('')
    cargar()
  }

  async function quitarOficio(label: string) {
    await supabase.from('oficios').delete().eq('user_id', yo).eq('label', label)
    cargar()
  }

  // El servidor rechaza activarlo sin habilidades y lo apaga al borrar la ultima:
  // despues de cada cambio se vuelve a leer para mostrar el estado real.
  async function cambiarOfrece(valor: boolean) {
    setOfrece(valor)
    const { error: e } = await supabase.from('profile_private').update({ ofrece_servicios: valor }).eq('user_id', yo)
    if (e) Alert.alert('No se pudo guardar', e.message)
    cargar()
  }

  async function cambiarDisponible(valor: boolean) {
    try {
      if (valor) setDisponibleHasta(await estoyDisponible())
      else {
        setDisponibleHasta(null)
        await yaNoDisponible()
      }
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e.message)
      cargar()
    }
  }

  async function cambiarAcepta(label: string, valor: boolean) {
    setOficios((lista) => lista.map((o) => (o.label === label ? { ...o, acepta_pedidos: valor } : o)))
    const { error: e } = await supabase.from('oficios').update({ acepta_pedidos: valor }).eq('user_id', yo).eq('label', label)
    if (e) {
      Alert.alert('No se pudo guardar', e.message)
      cargar()
    }
  }

  const disponible = disponibleAhora(disponibleHasta)
  const sinAgregar = (h: Habilidad) => !oficios.some((o) => o.catalog_id === h.id || o.label === h.label)
  const profesiones = habilidades.filter((h) => h.tipo === 'oficio' && sinAgregar(h))
  const tareas = habilidades.filter((h) => h.tipo === 'tarea' && sinAgregar(h))

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Titulo nivel={2}>Qué sabés hacer?</Titulo>
      <Texto suave>
        Sumá tu profesión y también esas tareas chicas por las que te moverías. Así un vecino puede encontrarte aunque
        no seas profesional de ese rubro.
      </Texto>
      <View style={estilos.ofrece}>
        <View style={{ flex: 1 }}>
          <Texto fuerte>Ofrezco servicios</Texto>
          <Texto suave style={{ fontSize: 14 }}>
            {oficios.length === 0
              ? 'Sumá al menos una habilidad para poder activarlo.'
              : 'Aparecés cuando alguien busca lo que sabés hacer. Se ve tu nombre, tus habilidades y tu barrio, nunca tu punto exacto.'}
          </Texto>
        </View>
        <Switch
          value={ofrece}
          disabled={oficios.length === 0}
          onValueChange={cambiarOfrece}
          trackColor={{ true: colores.naranja }}
          accessibilityLabel="Ofrezco servicios"
        />
      </View>
      {ofrece && (
        <View style={estilos.ofrece}>
          <View style={{ flex: 1 }}>
            <Texto fuerte>Disponible ahora</Texto>
            <Texto suave style={{ fontSize: 14 }}>
              {disponible && disponibleHasta
                ? `Aparecés primero en las búsquedas, ${textoDisponibleHasta(disponibleHasta)}.`
                : 'Prendelo cuando puedas tomar trabajitos. Se apaga solo a las 8 horas.'}
            </Texto>
          </View>
          <Switch
            value={disponible}
            onValueChange={cambiarDisponible}
            trackColor={{ true: colores.naranja }}
            accessibilityLabel="Disponible ahora"
          />
        </View>
      )}
      {oficios.length > 0 && (
        <Texto suave style={{ fontSize: 14 }}>
          Prendé las que aceptás hacer como trabajito. Tocá la X para borrar una.
        </Texto>
      )}
      <View style={{ gap: espacio.s }}>
        {oficios.map((o) => (
          <View key={o.label} style={estilos.filaOficio}>
            <Texto style={{ flex: 1 }}>{o.label}</Texto>
            <Switch
              value={o.acepta_pedidos}
              onValueChange={(v) => cambiarAcepta(o.label, v)}
              trackColor={{ true: colores.naranja }}
              accessibilityLabel={`Acepto trabajitos de ${o.label}`}
            />
            <Pressable onPress={() => quitarOficio(o.label)} accessibilityLabel={`Quitar ${o.label}`} hitSlop={10}>
              <X size={18} color={colores.texto2} />
            </Pressable>
          </View>
        ))}
      </View>
      <Titulo nivel={3}>Tu profesión u oficio</Titulo>
      <View style={estilos.etiquetas}>
        {profesiones.map((h) => (
          <Chip key={h.id} activo={false} onPress={() => agregarOficio(h.label, h.category_id, h.tipo, h.id)}>
            {h.label}
          </Chip>
        ))}
      </View>
      <Titulo nivel={3}>También puedo dar una mano con...</Titulo>
      <Texto suave>Por ejemplo, cambiar una lamparita, armar muebles o hacer un mandado.</Texto>
      <View style={estilos.etiquetas}>
        {tareas.map((h) => (
          <Chip key={h.id} activo={false} onPress={() => agregarOficio(h.label, h.category_id, h.tipo, h.id)}>
            {h.label}
          </Chip>
        ))}
      </View>
      <Campo etiqueta="O escribí algo que sabés hacer" value={oficioPropio} onChangeText={setOficioPropio} maxLength={40} />
      <Boton variante="secundario" deshabilitado={oficioPropio.trim().length < 2} onPress={() => agregarOficio(oficioPropio.trim(), null)}>
        Agregar habilidad
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
  filaOficio: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: 4 },
  ofrece: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.naranjaSuave,
  },
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
