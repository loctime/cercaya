import { router } from 'expo-router'
import { Search, UsersRound } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { fondoDe, iconoDe } from '../../components/IconoCategoria'
import { Boton, Texto, Titulo, Vacio } from '../../components/ui'
import { textoDistancia, useCategorias } from '../../lib/datos'
import { supabase } from '../../lib/supabase'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, radio } from '../../theme'

type Prestador = {
  user_id: string
  full_name: string
  zone_label: string | null
  distancia_km: number
  calificacion: number | null
  cant_resenas: number
}

// Etapa 1: categorias reales y lista basica de prestadores.
// La busqueda, los filtros y las tarjetas completas llegan en la etapa 2.
export default function Inicio() {
  const categorias = useCategorias()
  const { origen } = useUbicacion()
  const [filtro, setFiltro] = useState<number | null>(null)
  const [prestadores, setPrestadores] = useState<Prestador[] | null>(null)

  useEffect(() => {
    setPrestadores(null)
    supabase
      .rpc('buscar_prestadores', { p_categoria: filtro, p_lat: origen.lat, p_lng: origen.lng })
      .then(({ data }) => setPrestadores((data as Prestador[]) ?? []))
  }, [filtro, origen.lat, origen.lng])

  const rubro = categorias.find((c) => c.id === filtro)

  return (
    <FlatList
      style={{ backgroundColor: colores.fondo }}
      contentContainerStyle={{ paddingBottom: espacio.xxl }}
      data={prestadores ?? []}
      keyExtractor={(p) => p.user_id}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: espacio.l, gap: espacio.l }}>
          <View style={estilos.buscador}>
            <Search size={20} color={colores.texto2} />
            <Texto suave>Buscar plomero, pintor, corte de pasto...</Texto>
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

          <Titulo nivel={2}>{rubro ? rubro.name : 'Cerca tuyo'}</Titulo>
        </View>
      }
      renderItem={({ item }) => (
        <View style={estilos.tarjeta}>
          <Texto fuerte>{item.full_name}</Texto>
          <Texto suave>
            {[item.zone_label, textoDistancia(item.distancia_km)].filter(Boolean).join(', ')}
          </Texto>
        </View>
      )}
      ListEmptyComponent={
        prestadores === null ? null : (
          <Vacio
            icono={UsersRound}
            titulo={rubro ? `Todavía no hay prestadores de ${rubro.name.toLowerCase()} en esta zona` : 'Todavía no hay prestadores en esta zona'}
            texto="CercaYa está arrancando en Ramallo. Si sabés de un oficio, sumate como prestador."
          >
            <Boton variante="secundario" onPress={() => router.push('/perfil')}>
              Ofrecer mis servicios
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
  tarjeta: {
    marginHorizontal: espacio.l,
    marginTop: espacio.s,
    padding: espacio.l,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
    gap: 2,
  },
})
