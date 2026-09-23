import { router, useFocusEffect } from 'expo-router'
import { BriefcaseBusiness, ClipboardList, Search } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { TarjetaPedido, type PedidoLista } from '../../components/TarjetaPedido'
import { Boton, Texto, Vacio } from '../../components/ui'
import { useCategorias } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, fuentes, radio } from '../../theme'

type Fila = PedidoLista & { accion: string | null }
type Vista = 'cliente' | 'prestador'

const CAMPOS = 'id, title, category_id, urgency, zone_label, status, created_at, client_confirmed_at, assigned_provider_id'

async function misPedidos(yo: string): Promise<Fila[]> {
  const [{ data: jobs }, { data: mias }] = await Promise.all([
    supabase.from('jobs').select(`${CAMPOS}, applications(count)`).eq('client_id', yo).order('created_at', { ascending: false }),
    supabase.from('reviews').select('job_id').eq('reviewer_id', yo),
  ])
  const califique = new Set((mias ?? []).map((r) => r.job_id))
  return (jobs ?? []).map((j) => {
    const interesados = (j.applications as unknown as { count: number }[])[0]?.count ?? 0
    let accion: string | null = null
    if ((j.status === 'abierto' || j.status === 'en_conversacion') && interesados > 0)
      accion = `${interesados} ${interesados === 1 ? 'interesado' : 'interesados'}`
    else if (j.status === 'realizado' && !j.client_confirmed_at) accion = 'Confirmá el trabajo'
    else if (j.status === 'cerrado' && !califique.has(j.id)) accion = 'Calificá el trabajo'
    return { ...(j as unknown as PedidoLista), accion }
  })
}

async function misTrabajos(yo: string): Promise<Fila[]> {
  const [{ data: postulaciones }, { data: mias }] = await Promise.all([
    supabase.from('applications').select('job_id').eq('provider_id', yo),
    supabase.from('reviews').select('job_id').eq('reviewer_id', yo),
  ])
  const ids = (postulaciones ?? []).map((a) => a.job_id)
  const filtro = ids.length ? `assigned_provider_id.eq.${yo},id.in.(${ids.join(',')})` : `assigned_provider_id.eq.${yo}`
  const { data: jobs } = await supabase.from('jobs').select(CAMPOS).or(filtro).order('created_at', { ascending: false })
  const califique = new Set((mias ?? []).map((r) => r.job_id))
  return (jobs ?? []).map((j) => {
    const mio = j.assigned_provider_id === yo
    let accion: string | null = null
    if (mio && j.status === 'asignado') accion = 'Te lo asignaron'
    else if (mio && j.status === 'cerrado' && !califique.has(j.id)) accion = 'Calificá al cliente'
    else if (!mio && !['abierto', 'en_conversacion'].includes(j.status)) accion = 'Lo hace otra persona'
    return { ...(j as unknown as PedidoLista), accion }
  })
}

export default function Pedidos() {
  const { sesion } = useSesion()
  const categorias = useCategorias()
  const yo = sesion?.user.id
  const [vista, setVista] = useState<Vista>('cliente')
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [soyPrestador, setSoyPrestador] = useState(false)
  const [recargando, setRecargando] = useState(false)

  const cargar = useCallback(async () => {
    if (!yo) return
    const { data: pp } = await supabase.from('provider_profiles').select('status').eq('user_id', yo).maybeSingle()
    setSoyPrestador(pp?.status === 'aprobado')
    setFilas(vista === 'cliente' ? await misPedidos(yo) : await misTrabajos(yo))
  }, [yo, vista])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  return (
    <RequiereLogin
      icono={ClipboardList}
      titulo="Tus pedidos en un solo lugar"
      texto="Entrá para publicar pedidos y seguir cada trabajo, desde el primer mensaje hasta la calificación."
    >
      <FlatList
        style={{ backgroundColor: colores.fondo }}
        contentContainerStyle={{ gap: espacio.s, paddingBottom: espacio.xxl }}
        data={filas ?? []}
        keyExtractor={(f) => f.id}
        refreshControl={
          <RefreshControl
            refreshing={recargando}
            onRefresh={async () => {
              setRecargando(true)
              await cargar()
              setRecargando(false)
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: espacio.l, gap: espacio.m, paddingBottom: espacio.s }}>
            {soyPrestador && (
              <View style={estilos.selector}>
                {(
                  [
                    ['cliente', 'Mis pedidos'],
                    ['prestador', 'Mis trabajos'],
                  ] as const
                ).map(([v, t]) => (
                  <Pressable
                    key={v}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: vista === v }}
                    onPress={() => {
                      setFilas(null)
                      setVista(v)
                    }}
                    style={[estilos.opcion, vista === v && estilos.opcionActiva]}
                  >
                    <Texto style={[estilos.opcionTexto, vista === v && { color: colores.tinta }]}>{t}</Texto>
                  </Pressable>
                ))}
              </View>
            )}
            {soyPrestador && vista === 'prestador' && (
              <Boton variante="marca" icono={Search} onPress={() => router.push('/pedidos-cerca')}>
                Buscar pedidos cerca
              </Boton>
            )}
          </View>
        }
        renderItem={({ item }) => <TarjetaPedido p={item} categorias={categorias} accion={item.accion} />}
        ListEmptyComponent={
          filas === null ? (
            <ActivityIndicator color={colores.naranjaOscuro} style={{ marginTop: espacio.xl }} />
          ) : vista === 'cliente' ? (
            <Vacio
              icono={ClipboardList}
              titulo="Todavía no publicaste ningún pedido"
              texto="Contá qué necesitás y te avisamos cuando un prestador de tu zona se interese."
            >
              <Boton onPress={() => router.push('/publicar')}>Publicar pedido</Boton>
            </Vacio>
          ) : (
            <Vacio
              icono={BriefcaseBusiness}
              titulo="No tenés trabajos activos"
              texto="Buscá pedidos de tus rubros en tu zona y ofrecete."
            />
          )
        }
      />
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  selector: { flexDirection: 'row', backgroundColor: colores.grupo, borderRadius: radio.m, padding: 4 },
  opcion: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radio.s },
  opcionActiva: { backgroundColor: colores.fondo, borderWidth: 1, borderColor: colores.borde },
  opcionTexto: { fontFamily: fuentes.textoFuerte, color: colores.texto2 },
})
