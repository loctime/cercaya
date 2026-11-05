import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { espacio } from '../theme'

type Habilidad = { id: string; label: string; category_id: number | null; tipo: 'oficio' | 'tarea' }

// Paso opcional despues de crear la cuenta: que sabe hacer la persona.
// Si elige algo se activa "Ofrezco servicios"; todo se puede cambiar despues
// desde Perfil > Qué sabés hacer.
export default function HabilidadesInicio() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id
  const [catalogo, setCatalogo] = useState<Habilidad[]>([])
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [propias, setPropias] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase
      .from('habilidades_catalogo')
      .select('id, label, category_id, tipo')
      .order('tipo')
      .order('label')
      .then(({ data }) => setCatalogo((data as Habilidad[]) ?? []))
  }, [])

  function alternar(id: string) {
    setElegidas((previas) => {
      const nuevas = new Set(previas)
      if (nuevas.has(id)) nuevas.delete(id)
      else nuevas.add(id)
      return nuevas
    })
  }

  function agregarPropia() {
    const t = texto.trim()
    if (t.length < 2) return
    const repetida = [...propias, ...catalogo.map((h) => h.label)].some((x) => x.toLowerCase() === t.toLowerCase())
    if (!repetida) setPropias((p) => [...p, t])
    setTexto('')
  }

  async function guardar() {
    if (!yo || elegidas.size + propias.length === 0) return router.back()
    setCargando(true)
    const filas = catalogo
      .filter((h) => elegidas.has(h.id))
      .map((h) => ({ user_id: yo, label: h.label, category_id: h.category_id, tipo: h.tipo, catalog_id: h.id }))
    // Las escritas a mano: un trigger del servidor las vincula al catalogo si coinciden.
    for (const label of propias) filas.push({ user_id: yo, label, category_id: null, tipo: 'oficio', catalog_id: null as any })
    const { error: e1 } = await supabase.from('oficios').insert(filas)
    // El servidor solo deja activarlo si ya hay habilidades cargadas.
    const { error: e2 } = e1
      ? { error: null }
      : await supabase.from('profile_private').update({ ofrece_servicios: true }).eq('user_id', yo)
    setCargando(false)
    if (e1 || e2) {
      Alert.alert('No se pudo guardar', 'Podés cargarlas después desde Perfil > Qué sabés hacer.')
    }
    router.back()
  }

  const profesiones = catalogo.filter((h) => h.tipo === 'oficio')
  const tareas = catalogo.filter((h) => h.tipo === 'tarea')
  const lista = (items: Habilidad[]) => (
    <View style={estilos.etiquetas}>
      {items.map((h) => (
        <Chip key={h.id} activo={elegidas.has(h.id)} onPress={() => alternar(h.id)}>
          {h.label}
        </Chip>
      ))}
    </View>
  )

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Titulo>Qué sabés hacer?</Titulo>
      <Texto suave>
        Si querés que tus vecinos te encuentren cuando necesitan una mano, marcá lo que sabés hacer. Se ve tu nombre, tus
        habilidades y tu barrio, nunca tu punto exacto. Es opcional y lo cambiás cuando quieras.
      </Texto>
      <Titulo nivel={3}>Tu profesión u oficio</Titulo>
      {lista(profesiones)}
      <Titulo nivel={3}>También puedo dar una mano con...</Titulo>
      {lista(tareas)}
      <Campo etiqueta="O escribí algo que sabés hacer" value={texto} onChangeText={setTexto} maxLength={40} />
      <Boton variante="secundario" deshabilitado={texto.trim().length < 2} onPress={agregarPropia}>
        Agregar
      </Boton>
      {propias.length > 0 && (
        <View style={estilos.etiquetas}>
          {propias.map((p) => (
            <Chip key={p} activo onPress={() => setPropias((l) => l.filter((x) => x !== p))}>
              {p}
            </Chip>
          ))}
        </View>
      )}
      <Boton onPress={guardar} cargando={cargando}>
        {elegidas.size + propias.length > 0 ? `Listo (${elegidas.size + propias.length})` : 'Listo'}
      </Boton>
      <Boton variante="secundario" onPress={() => router.back()}>
        Ahora no
      </Boton>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.m },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
})
