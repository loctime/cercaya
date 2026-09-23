import { router } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { ImagePlus, MapPin, Phone, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { useCategorias } from '../lib/datos'
import { elegirImagenes, subirImagen, urlPublica, type FotoLocal } from '../lib/imagenes'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { useUbicacion } from '../lib/ubicacion'
import { colores, espacio, radio } from '../theme'

const RADIOS = [5, 10, 15, 20, 30]
const MAX_FOTOS = 6

type FotoGuardada = { id: string; storage_path: string }
type Estado = 'pendiente' | 'aprobado' | 'suspendido'

export default function MisServicios() {
  const alturaHeader = useHeaderHeight()
  const { sesion } = useSesion()
  const { origen } = useUbicacion()
  const categorias = useCategorias()
  const yo = sesion?.user.id ?? ''

  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [rubros, setRubros] = useState<Set<number>>(new Set())
  const [rubrosOriginales, setRubrosOriginales] = useState<Set<number>>(new Set())
  const [bio, setBio] = useState('')
  const [precios, setPrecios] = useState('')
  const [radioKm, setRadioKm] = useState(15)
  const [activo, setActivo] = useState(true)
  const [fotos, setFotos] = useState<FotoGuardada[]>([])
  const [fotosNuevas, setFotosNuevas] = useState<FotoLocal[]>([])
  const [fotosBorradas, setFotosBorradas] = useState<FotoGuardada[]>([])
  const [muestraTelefono, setMuestraTelefono] = useState(true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [pp, servicios, fts, priv] = await Promise.all([
        supabase.from('provider_profiles').select('bio, price_range, coverage_radius_km, status, is_active').eq('user_id', yo).maybeSingle(),
        supabase.from('provider_services').select('category_id').eq('user_id', yo),
        supabase.from('provider_photos').select('id, storage_path').eq('user_id', yo).order('position'),
        supabase.from('profile_private').select('show_phone').eq('user_id', yo).single(),
      ])
      if (pp.data) {
        setEstado(pp.data.status as Estado)
        setBio(pp.data.bio ?? '')
        setPrecios(pp.data.price_range ?? '')
        setRadioKm(pp.data.coverage_radius_km)
        setActivo(pp.data.is_active)
      }
      const ids = new Set((servicios.data ?? []).map((s) => s.category_id as number))
      setRubros(ids)
      setRubrosOriginales(new Set(ids))
      setFotos(fts.data ?? [])
      setMuestraTelefono(!!priv.data?.show_phone)
      setCargando(false)
    })()
  }, [yo])

  const totalFotos = fotos.length + fotosNuevas.length

  function alternarRubro(id: number) {
    setRubros((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  async function sumarFotos() {
    const nuevas = await elegirImagenes(MAX_FOTOS - totalFotos)
    setFotosNuevas((f) => [...f, ...nuevas].slice(0, MAX_FOTOS - fotos.length))
  }

  async function guardar() {
    setError('')
    if (rubros.size === 0) return setError('Elegí al menos un rubro.')
    if (bio.trim().length < 20) return setError('Contá un poco de tu experiencia (al menos 20 letras).')
    setGuardando(true)
    try {
      const datos = { bio: bio.trim(), price_range: precios.trim() || null, coverage_radius_km: radioKm, is_active: activo }
      const r = estado
        ? await supabase.from('provider_profiles').update(datos).eq('user_id', yo)
        : await supabase.from('provider_profiles').insert({ user_id: yo, ...datos })
      if (r.error) throw r.error

      const quitar = [...rubrosOriginales].filter((id) => !rubros.has(id))
      const agregar = [...rubros].filter((id) => !rubrosOriginales.has(id))
      if (quitar.length) {
        const q = await supabase.from('provider_services').delete().eq('user_id', yo).in('category_id', quitar)
        if (q.error) throw q.error
      }
      if (agregar.length) {
        const a = await supabase.from('provider_services').insert(agregar.map((category_id) => ({ user_id: yo, category_id })))
        if (a.error) throw a.error
      }

      for (const f of fotosBorradas) {
        await supabase.from('provider_photos').delete().eq('id', f.id)
        await supabase.storage.from('galeria').remove([f.storage_path])
      }
      for (const [i, f] of fotosNuevas.entries()) {
        const ruta = await subirImagen('galeria', yo, f)
        const ins = await supabase.from('provider_photos').insert({ user_id: yo, storage_path: ruta, position: fotos.length + i })
        if (ins.error) throw ins.error
      }

      if (!estado) {
        Alert.alert(
          'Listo, quedó en revisión',
          'Revisamos tu perfil y te avisamos cuando aparezcas en el catálogo. Suele ser en el día.',
          [{ text: 'Entendido', onPress: () => router.back() }],
        )
      } else {
        router.back()
      }
    } catch {
      setError('No pudimos guardar. Revisá tu conexión y probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} />
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? alturaHeader : 0}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {!estado && (
          <View style={estilos.aviso}>
            <Texto>
              Al enviar tus datos, tu perfil pasa a <Texto fuerte>En revisión</Texto>. Lo revisamos antes de publicarlo en el
              catálogo.
            </Texto>
          </View>
        )}

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={3}>Qué hacés</Titulo>
          <View style={estilos.fila}>
            {categorias.map((c) => (
              <Chip key={c.id} activo={rubros.has(c.id)} onPress={() => alternarRubro(c.id)}>
                {c.name}
              </Chip>
            ))}
          </View>
        </View>

        <Campo
          etiqueta="Tu experiencia"
          placeholder="Ej: Plomero hace 10 años. Destapaciones, pérdidas, termotanques. Trabajo con garantía."
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={1000}
          style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: espacio.m }}
        />
        <Campo
          etiqueta="Precios de referencia (opcional)"
          placeholder="Ej: Visita $8.000, presupuesto sin cargo"
          value={precios}
          onChangeText={setPrecios}
          maxLength={120}
        />

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={3}>Hasta dónde trabajás</Titulo>
          <Pressable accessibilityRole="button" onPress={() => router.push('/localidad')} style={estilos.zona}>
            <MapPin size={18} color={colores.naranjaOscuro} />
            <Texto style={{ flex: 1 }}>Desde {origen.etiqueta}</Texto>
            <Texto fuerte style={{ color: colores.naranjaOscuro }}>Cambiar</Texto>
          </Pressable>
          <View style={estilos.fila}>
            {RADIOS.map((km) => (
              <Chip key={km} activo={radioKm === km} onPress={() => setRadioKm(km)}>
                {`${km} km`}
              </Chip>
            ))}
          </View>
        </View>

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={3}>Fotos de tus trabajos ({totalFotos}/{MAX_FOTOS})</Titulo>
          <Texto suave style={{ fontSize: 14 }}>Los perfiles con fotos reales reciben más consultas.</Texto>
          <View style={estilos.galeria}>
            {fotos.map((f) => (
              <View key={f.id} style={estilos.foto}>
                <Image source={{ uri: urlPublica('galeria', f.storage_path) }} style={StyleSheet.absoluteFill} />
                <Pressable
                  accessibilityLabel="Quitar foto"
                  onPress={() => {
                    setFotos((t) => t.filter((x) => x.id !== f.id))
                    setFotosBorradas((t) => [...t, f])
                  }}
                  style={estilos.quitar}
                >
                  <X size={16} color={colores.blanco} />
                </Pressable>
              </View>
            ))}
            {fotosNuevas.map((f, i) => (
              <View key={f.uri} style={estilos.foto}>
                <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} />
                <Pressable
                  accessibilityLabel="Quitar foto"
                  onPress={() => setFotosNuevas((t) => t.filter((_, j) => j !== i))}
                  style={estilos.quitar}
                >
                  <X size={16} color={colores.blanco} />
                </Pressable>
              </View>
            ))}
            {totalFotos < MAX_FOTOS && (
              <Pressable accessibilityRole="button" onPress={sumarFotos} style={[estilos.foto, estilos.sumarFoto]}>
                <ImagePlus size={26} color={colores.texto2} />
                <Texto suave style={{ fontSize: 12 }}>Sumar</Texto>
              </Pressable>
            )}
          </View>
        </View>

        {!muestraTelefono && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/privacidad')} style={estilos.sugerencia}>
            <Phone size={20} color={colores.exito} />
            <Texto style={{ flex: 1, fontSize: 14 }}>
              Los vecinos te contactan más rápido por WhatsApp. <Texto fuerte>Mostrar mi número</Texto>
            </Texto>
          </Pressable>
        )}

        {estado && (
          <View style={estilos.pausa}>
            <View style={{ flex: 1 }}>
              <Texto fuerte>Recibir consultas</Texto>
              <Texto suave style={{ fontSize: 13 }}>
                {activo ? 'Aparecés en el catálogo.' : 'Pausado: no aparecés en el catálogo.'}
              </Texto>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              trackColor={{ true: colores.naranja, false: colores.borde }}
              thumbColor={colores.fondo}
              accessibilityLabel="Recibir consultas"
            />
          </View>
        )}

        {error ? <Texto style={{ color: colores.peligro }}>{error}</Texto> : null}
        <Boton onPress={guardar} cargando={guardando}>
          {estado ? 'Guardar cambios' : 'Enviar para revisión'}
        </Boton>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.xl, paddingBottom: espacio.xxl },
  aviso: { padding: espacio.l, borderRadius: radio.m, backgroundColor: colores.naranjaSuave },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  zona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 48,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
    borderWidth: 1.5,
    borderColor: colores.borde,
  },
  galeria: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  foto: { width: 96, height: 96, borderRadius: radio.m, overflow: 'hidden', backgroundColor: colores.grupo },
  sumarFoto: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colores.borde,
    gap: 2,
  },
  quitar: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: radio.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.l,
    borderRadius: radio.m,
    backgroundColor: '#ECFDF5',
  },
  pausa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.l,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
  },
})
