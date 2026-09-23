import { router, useFocusEffect } from 'expo-router'
import { Search, UsersRound, X } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { fondoDe, iconoDe } from '../../components/IconoCategoria'
import { TarjetaPrestador, type PrestadorLista } from '../../components/TarjetaPrestador'
import { Boton, Texto, Titulo, Vacio } from '../../components/ui'
import { useCategorias } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, fuentes, radio } from '../../theme'

type Orden = 'cercania' | 'calificacion'

export default function Inicio() {
  const categorias = useCategorias()
  const { sesion } = useSesion()
  const { origen } = useUbicacion()
  const [filtro, setFiltro] = useState<number | null>(null)
  const [orden, setOrden] = useState<Orden>('cercania')
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [prestadores, setPrestadores] = useState<PrestadorLista[] | null>(null)
  const pedido = useRef(0)

  // Espera a que el usuario deje de tipear antes de consultar.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350)
    return () => clearTimeout(t)
  }, [texto])

  const cargar = useCallback(async () => {
    const n = ++pedido.current
    const { data } = await supabase.rpc('buscar_prestadores', {
      p_categoria: filtro,
      p_texto: busqueda || null,
      p_orden: orden,
      p_lat: origen.lat,
      p_lng: origen.lng,
    })
    // Descarta respuestas viejas si el usuario cambio el filtro mientras tanto.
    if (n === pedido.current) setPrestadores((data as PrestadorLista[]) ?? [])
  }, [filtro, busqueda, orden, origen.lat, origen.lng])

  // Corre al entrar a la pestania, al volver (por ejemplo despues de
  // bloquear a alguien) y cada vez que cambian filtros u orden.
  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  const rubro = categorias.find((c) => c.id === filtro)
  const titulo = busqueda ? `Resultados para "${busqueda}"` : rubro ? rubro.name : 'Cerca tuyo'

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingBottom: espacio.xxl, gap: espacio.s }}
      keyboardShouldPersistTaps="handled"
      data={prestadores ?? []}
      keyExtractor={(p) => p.user_id}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: espacio.l, gap: espacio.l, paddingBottom: espacio.xs }}>
          <View style={estilos.buscador}>
            <Search size={20} color={colores.texto2} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Buscar plomero, pintor, corte de pasto..."
              placeholderTextColor={colores.texto2}
              returnKeyType="search"
              style={estilos.buscadorInput}
              accessibilityLabel="Buscar prestadores"
            />
            {texto ? (
              <Pressable accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => setTexto('')}>
                <X size={20} color={colores.texto2} />
              </Pressable>
            ) : null}
          </View>

          <View style={estilos.grilla}>
            {categorias.map((c) => {
              const Icono = iconoDe(c.icon)
              const activa = filtro === c.id
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activa }}
                  onPress={() => setFiltro(activa ? null : c.id)}
                  style={[estilos.categoria, { backgroundColor: fondoDe(c.sort) }, activa && estilos.categoriaActiva]}
                >
                  <Icono size={26} color={colores.tinta} />
                  <Texto style={estilos.categoriaTexto} numberOfLines={2}>
                    {c.name}
                  </Texto>
                </Pressable>
              )
            })}
          </View>

          <View style={{ gap: espacio.s }}>
            <Titulo nivel={2}>{titulo}</Titulo>
            <View style={estilos.chips}>
              {rubro && (
                <Pressable accessibilityRole="button" onPress={() => setFiltro(null)} style={[estilos.chip, estilos.chipActivo]}>
                  <X size={14} color={colores.tinta} />
                  <Texto style={estilos.chipTexto}>Quitar filtro</Texto>
                </Pressable>
              )}
              {(
                [
                  ['cercania', 'Más cercanos'],
                  ['calificacion', 'Mejor calificados'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <Pressable
                  key={valor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: orden === valor }}
                  onPress={() => setOrden(valor)}
                  style={[estilos.chip, orden === valor && estilos.chipActivo]}
                >
                  <Texto style={estilos.chipTexto}>{etiqueta}</Texto>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => <TarjetaPrestador p={item} categorias={categorias} conSesion={!!sesion} />}
      ListEmptyComponent={
        prestadores === null ? (
          <ActivityIndicator color={colores.naranjaOscuro} style={{ marginTop: espacio.xl }} />
        ) : (
          <Vacio
            icono={UsersRound}
            titulo={
              busqueda
                ? `No encontramos prestadores para "${busqueda}"`
                : rubro
                  ? `Todavía no hay prestadores de ${rubro.name.toLowerCase()} en esta zona`
                  : 'Todavía no hay prestadores en esta zona'
            }
            texto="CercaYa está arrancando en Ramallo. Si sabés de un oficio, sumate como prestador."
          >
            <Boton variante="secundario" onPress={() => router.push('/localidad')}>
              Cambiar de localidad
            </Boton>
            <Boton variante="marca" onPress={() => router.push(sesion ? '/mis-servicios' : '/login')}>
              Ofrecer este servicio
            </Boton>
          </Vacio>
        )
      }
    />
  )
}

const estilos = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: 50,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
    borderWidth: 1.5,
    borderColor: colores.borde,
  },
  buscadorInput: { flex: 1, fontFamily: fuentes.texto, fontSize: 16, color: colores.tinta, paddingVertical: espacio.s },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  categoria: {
    width: '23%',
    flexGrow: 1,
    aspectRatio: 0.95,
    borderRadius: radio.m,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.xs,
    padding: espacio.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoriaActiva: { borderColor: colores.naranja },
  categoriaTexto: { fontSize: 12, lineHeight: 15, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: espacio.m,
    borderRadius: radio.full,
    borderWidth: 1.5,
    borderColor: colores.borde,
  },
  chipActivo: { backgroundColor: colores.naranja, borderColor: colores.naranja },
  chipTexto: { fontFamily: fuentes.textoFuerte, fontSize: 14, color: colores.tinta },
})
