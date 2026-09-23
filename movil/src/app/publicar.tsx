import { router } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { ImagePlus, MapPin, X } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Chip } from '../components/Chip'
import { fondoDe, iconoDe } from '../components/IconoCategoria'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { useCategorias } from '../lib/datos'
import { elegirFotos, proximosDias, subirFotosPedido, URGENCIAS, type FotoLocal, type Urgencia } from '../lib/pedidos'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { useUbicacion } from '../lib/ubicacion'
import { colores, espacio, radio } from '../theme'

const PASOS = ['Qué necesitás', 'Contanos qué pasa', 'Dónde y cuándo'] as const

// El titulo que se ve en las listas sale del comienzo del texto: una sola caja
// para escribir es mas facil que pedir titulo y descripcion por separado.
function tituloDesde(texto: string) {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  const primera = limpio.split(/[.!?]/)[0].trim()
  const base = primera.length >= 10 ? primera : limpio
  if (base.length <= 60) return base
  const corte = base.slice(0, 60)
  const ultimo = corte.lastIndexOf(' ')
  return (ultimo > 30 ? corte.slice(0, ultimo) : corte) + '...'
}

export default function Publicar() {
  const insets = useSafeAreaInsets()
  const alturaHeader = useHeaderHeight()
  const { sesion } = useSesion()
  const { origen } = useUbicacion()
  const categorias = useCategorias()
  const [paso, setPaso] = useState(0)
  const [categoria, setCategoria] = useState<number | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [fotos, setFotos] = useState<FotoLocal[]>([])
  const [urgencia, setUrgencia] = useState<Urgencia | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [publicando, setPublicando] = useState(false)

  // Que falta para avanzar (null = nada). El boton nunca queda muerto:
  // si falta algo, al tocarlo se explica que.
  const falta =
    paso === 0 && categoria == null
      ? 'Elegí qué necesitás.'
      : paso === 1 && (descripcion.trim().length < 10 || tituloDesde(descripcion).length < 3)
        ? 'Contanos un poco más de lo que necesitás (una frase alcanza).'
        : paso === 2 && urgencia == null
          ? 'Elegí para cuándo lo necesitás.'
          : null

  function avanzar() {
    if (falta) return setError(falta)
    setError('')
    if (paso < 2) setPaso(paso + 1)
    else publicar()
  }

  async function sumarFotos() {
    const nuevas = await elegirFotos(3 - fotos.length)
    setFotos((f) => [...f, ...nuevas].slice(0, 3))
  }

  async function publicar() {
    setError('')
    setPublicando(true)
    const { data: jobId, error: e } = await supabase.rpc('publicar_pedido', {
      p_category: categoria!,
      p_title: tituloDesde(descripcion),
      p_description: descripcion.trim(),
      p_urgency: urgencia!,
      p_preferred_date: fecha,
      p_lat: origen.lat,
      p_lng: origen.lng,
    })
    if (e || !jobId) {
      setPublicando(false)
      setError(e?.message.includes('limite') ? 'Llegaste al límite de 5 pedidos por día.' : 'No pudimos publicar el pedido.')
      return
    }
    if (fotos.length) {
      try {
        await subirFotosPedido(jobId as string, sesion!.user.id, fotos)
      } catch {
        Alert.alert('Pedido publicado', 'No pudimos subir alguna de las fotos. Podés seguir sin ellas.')
      }
    }
    setPublicando(false)
    router.replace({ pathname: '/pedido/[id]', params: { id: jobId as string } })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? alturaHeader : 0}
    >
      <View style={estilos.progreso}>
        {PASOS.map((p, i) => (
          <View key={p} style={[estilos.barrita, i <= paso && { backgroundColor: colores.naranja }]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Texto suave>
          Paso {paso + 1} de 3
        </Texto>
        <Titulo>{PASOS[paso]}</Titulo>

        {paso === 0 && (
          <View style={estilos.grilla}>
            {categorias.map((c) => {
              const Icono = iconoDe(c.icon)
              const activa = categoria === c.id
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activa }}
                  onPress={() => setCategoria(c.id)}
                  style={[estilos.categoria, { backgroundColor: fondoDe(c.sort) }, activa && estilos.categoriaActiva]}
                >
                  <Icono size={24} color={colores.tinta} />
                  <Texto style={{ flex: 1, fontSize: 14 }}>{c.name}</Texto>
                </Pressable>
              )
            })}
          </View>
        )}

        {paso === 1 && (
          <>
            <Campo
              etiqueta="Contanos qué arreglo o trabajo necesitás"
              placeholder="Ej: Cortar el pasto del fondo y juntar las ramas"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              maxLength={2000}
              style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: espacio.m }}
            />
            <Texto fuerte style={{ fontSize: 14 }}>Fotos (opcional, hasta 3)</Texto>
            <View style={estilos.fotos}>
              {fotos.map((f, i) => (
                <View key={f.uri} style={estilos.foto}>
                  <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} />
                  <Pressable
                    accessibilityLabel="Quitar foto"
                    onPress={() => setFotos((todas) => todas.filter((_, j) => j !== i))}
                    style={estilos.quitar}
                  >
                    <X size={16} color={colores.blanco} />
                  </Pressable>
                </View>
              ))}
              {fotos.length < 3 && (
                <Pressable accessibilityRole="button" onPress={sumarFotos} style={[estilos.foto, estilos.sumarFoto]}>
                  <ImagePlus size={26} color={colores.texto2} />
                  <Texto suave style={{ fontSize: 14 }}>Sumar</Texto>
                </Pressable>
              )}
            </View>
          </>
        )}

        {paso === 2 && (
          <>
            <View style={{ gap: espacio.s }}>
              <Texto fuerte style={{ fontSize: 14 }}>Dónde</Texto>
              <Pressable accessibilityRole="button" onPress={() => router.push('/localidad')} style={estilos.zona}>
                <MapPin size={20} color={colores.naranjaOscuro} />
                <Texto style={{ flex: 1 }}>
                  {origen.etiqueta}
                  {origen.fuente === 'gps' ? ' (tu ubicación)' : ''}
                </Texto>
                <Texto style={{ color: colores.naranjaOscuro }} fuerte>
                  Cambiar
                </Texto>
              </Pressable>
              <Texto suave style={{ fontSize: 14 }}>
                Los prestadores solo ven la localidad y una distancia aproximada, nunca tu dirección.
              </Texto>
            </View>

            <View style={{ gap: espacio.s }}>
              <Texto fuerte style={{ fontSize: 14 }}>Para cuándo</Texto>
              <View style={estilos.fila}>
                {URGENCIAS.map((u) => (
                  <Chip key={u.valor} activo={urgencia === u.valor} onPress={() => setUrgencia(u.valor)}>
                    {u.texto}
                  </Chip>
                ))}
              </View>
            </View>

            <View style={{ gap: espacio.s }}>
              <Texto fuerte style={{ fontSize: 14 }}>Fecha preferida (opcional)</Texto>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
                {proximosDias().map((d) => (
                  <Chip key={d.iso} activo={fecha === d.iso} onPress={() => setFecha(fecha === d.iso ? null : d.iso)}>
                    {`${d.etiqueta} ${d.dia}`}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          </>
        )}

      </ScrollView>

      {error ? (
        <View style={estilos.aviso} accessibilityLiveRegion="polite">
          <Texto style={{ color: colores.peligro, fontSize: 14 }}>{error}</Texto>
        </View>
      ) : null}
      <View style={[estilos.acciones, { paddingBottom: insets.bottom + espacio.m }]}>
        {paso > 0 && (
          <Boton
            variante="secundario"
            onPress={() => {
              setError('')
              setPaso(paso - 1)
            }}
            style={{ flex: 1 }}
          >
            Atrás
          </Boton>
        )}
        <Boton onPress={avanzar} cargando={publicando} style={{ flex: 2 }}>
          {paso < 2 ? 'Siguiente' : 'Publicar pedido'}
        </Boton>
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  progreso: { flexDirection: 'row', gap: espacio.xs, paddingHorizontal: espacio.xl, paddingTop: espacio.m },
  barrita: { flex: 1, height: 4, borderRadius: radio.full, backgroundColor: colores.borde },
  contenido: { padding: espacio.xl, gap: espacio.l, paddingBottom: espacio.xxl },
  grilla: { gap: espacio.s },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: 56,
    paddingHorizontal: espacio.l,
    borderRadius: radio.m,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoriaActiva: { borderColor: colores.naranja },
  fotos: { flexDirection: 'row', gap: espacio.s },
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
  zona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 52,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
    borderWidth: 1.5,
    borderColor: colores.borde,
  },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  aviso: {
    paddingHorizontal: espacio.xl,
    paddingVertical: espacio.s,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  acciones: {
    flexDirection: 'row',
    gap: espacio.s,
    paddingHorizontal: espacio.xl,
    paddingTop: espacio.m,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    backgroundColor: colores.fondo,
  },
})
