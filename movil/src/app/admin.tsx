import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { fecha, useCategorias } from '../lib/datos'
import { MOTIVOS_DENUNCIA } from '../lib/moderacion'
import {
  adminBajas, adminBuscarNegocios, adminOcultarNegocio, adminReclamos, adminResolverBaja, adminResolverReclamo,
  diasRestantes, urlInstagram,
  type BajaAdmin, type NegocioAdmin, type ReclamoAdmin,
} from '../lib/negocios'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { colores, espacio, radio } from '../theme'

type Prestador = {
  user_id: string
  bio: string | null
  price_range: string | null
  status: 'pendiente' | 'aprobado' | 'suspendido'
  created_at: string
  perfil: { full_name: string; avatar_url: string | null; zone_label: string | null } | null
  provider_services: { category_id: number }[]
}
type Denuncia = {
  id: string
  target_type: string
  target_id: string
  reason: string
  detail: string | null
  created_at: string
}

type Vista = 'pendiente' | 'aprobado' | 'suspendido' | 'denuncias' | 'reclamos' | 'bajas' | 'negocios'

const ESTADO_NEGOCIO = { sin_reclamar: 'Sin reclamar', reclamado: 'Reclamado', oculto: 'Oculto' } as const

// Buscar un negocio por nombre o Instagram y ocultarlo a mano (pedidos por mail o mensaje directo).
function BuscarNegocios() {
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState<NegocioAdmin[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  async function buscar() {
    setBuscando(true)
    try {
      setLista(await adminBuscarNegocios(texto))
    } catch (e) {
      Alert.alert('No se pudo', (e as Error).message)
    } finally {
      setBuscando(false)
    }
  }

  function ocultar(n: NegocioAdmin) {
    Alert.alert('Ocultar negocio', `${n.nombre} (@${n.instagram_usuario}) sale del mapa para todos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ocultar',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminOcultarNegocio(n.id, 'Pedido por mail o mensaje')
            buscar()
          } catch (e) {
            Alert.alert('No se pudo', (e as Error).message)
          }
        },
      },
    ])
  }

  return (
    <View style={{ gap: espacio.m }}>
      <Campo
        etiqueta="Nombre o Instagram"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={buscar}
      />
      <Boton cargando={buscando} deshabilitado={texto.trim().length < 2} onPress={buscar}>
        Buscar
      </Boton>
      {lista !== null && lista.length === 0 && (
        <Texto suave style={{ textAlign: 'center' }}>No encontramos nada.</Texto>
      )}
      {lista?.map((n) => (
        <View key={n.id} style={estilos.tarjeta}>
          <Titulo nivel={3}>{n.nombre}</Titulo>
          <Pressable onPress={() => Linking.openURL(urlInstagram(n.instagram_usuario))}>
            <Texto fuerte style={{ color: colores.naranjaOscuro }}>@{n.instagram_usuario}</Texto>
          </Pressable>
          <Texto suave style={{ fontSize: 14 }}>{ESTADO_NEGOCIO[n.estado]}</Texto>
          {n.estado !== 'oculto' ? (
            <Boton variante="peligro" onPress={() => ocultar(n)}>
              Ocultar del mapa
            </Boton>
          ) : (
            <Texto suave style={{ fontSize: 14 }}>
              Para devolverlo al mapa: pestaña Bajas &gt; Ocultos.
            </Texto>
          )}
        </View>
      ))}
    </View>
  )
}

// Panel de administracion: aprobar prestadores y revisar denuncias.
// Solo lo ven usuarios con is_admin (la base lo vuelve a chequear).
export default function Admin() {
  const { perfil } = useSesion()
  const categorias = useCategorias()
  const [vista, setVista] = useState<Vista>('pendiente')
  const [prestadores, setPrestadores] = useState<Prestador[] | null>(null)
  const [denuncias, setDenuncias] = useState<Denuncia[] | null>(null)
  const [reclamos, setReclamos] = useState<ReclamoAdmin[] | null>(null)
  const [bajas, setBajas] = useState<BajaAdmin[] | null>(null)
  const [bajaEstado, setBajaEstado] = useState<'pendiente' | 'confirmada'>('pendiente')

  const cargar = useCallback(async () => {
    if (vista === 'reclamos') {
      setReclamos(await adminReclamos().catch(() => []))
    } else if (vista === 'bajas') {
      setBajas(await adminBajas(bajaEstado).catch(() => []))
    } else if (vista === 'denuncias') {
      const { data } = await supabase
        .from('reports')
        .select('id, target_type, target_id, reason, detail, created_at')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: false })
      setDenuncias(data ?? [])
    } else {
      const { data } = await supabase
        .from('provider_profiles')
        .select('user_id, bio, price_range, status, created_at, perfil:profiles!provider_profiles_user_id_fkey(full_name, avatar_url), provider_services(category_id)')
        .eq('status', vista)
        .order('created_at', { ascending: false })
      setPrestadores((data as unknown as Prestador[]) ?? [])
    }
  }, [vista, bajaEstado])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  async function estado(p: Prestador, nuevo: Prestador['status']) {
    const { error } = await supabase.rpc('admin_estado_prestador', { p_user: p.user_id, p_status: nuevo })
    if (error) return Alert.alert('No se pudo', error.message)
    cargar()
  }

  function resolverReclamo(r: ReclamoAdmin, aprueba: boolean) {
    Alert.alert(
      aprueba ? 'Aprobar reclamo' : 'Rechazar reclamo',
      `${r.negocio_nombre} (@${r.instagram_usuario}) · código ${r.codigo}. ${
        aprueba ? 'Comprobaste que mandaron el código por mensaje?' : 'Se le avisa a quien lo pidió.'
      }`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: aprueba ? 'Aprobar' : 'Rechazar',
          style: aprueba ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminResolverReclamo(r.id, aprueba)
              cargar()
            } catch (e) {
              Alert.alert('No se pudo', (e as Error).message)
            }
          },
        },
      ],
    )
  }

  async function resolverBaja(b: BajaAdmin, confirma: boolean) {
    try {
      await adminResolverBaja(b.id, confirma)
      cargar()
    } catch (e) {
      Alert.alert('No se pudo', (e as Error).message)
    }
  }

  async function resolver(d: Denuncia, nuevo: 'revisada' | 'descartada') {
    const { error } = await supabase.rpc('admin_resolver_denuncia', { p_report: d.id, p_status: nuevo })
    if (error) return Alert.alert('No se pudo', error.message)
    cargar()
  }

  if (!perfil?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: espacio.xl }}>
        <Texto style={{ textAlign: 'center' }}>Esta sección es solo para administradores.</Texto>
      </View>
    )
  }

  const lista = vista === 'reclamos' ? reclamos : vista === 'bajas' ? bajas : vista === 'denuncias' ? denuncias : prestadores

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.chips}>
        {(
          [
            ['pendiente', 'Por aprobar'],
            ['aprobado', 'Aprobados'],
            ['suspendido', 'Suspendidos'],
            ['denuncias', 'Denuncias'],
            ['reclamos', 'Reclamos'],
            ['bajas', 'Bajas'],
            ['negocios', 'Negocios'],
          ] as const
        ).map(([v, t]) => (
          <Chip
            key={v}
            activo={vista === v}
            onPress={() => {
              setPrestadores(null)
              setDenuncias(null)
              setReclamos(null)
              setBajas(null)
              setVista(v)
            }}
          >
            {t}
          </Chip>
        ))}
      </View>

      {vista === 'bajas' && (
        <View style={estilos.chips}>
          {(
            [
              ['pendiente', 'Pendientes'],
              ['confirmada', 'Ocultos'],
            ] as const
          ).map(([v, t]) => (
            <Chip
              key={v}
              activo={bajaEstado === v}
              onPress={() => {
                setBajas(null)
                setBajaEstado(v)
              }}
            >
              {t}
            </Chip>
          ))}
        </View>
      )}

      {vista === 'negocios' ? (
        <BuscarNegocios />
      ) : lista === null ? (
        <ActivityIndicator color={colores.naranjaOscuro} />
      ) : lista.length === 0 ? (
        <Texto suave style={{ textAlign: 'center', marginTop: espacio.xl }}>No hay nada acá.</Texto>
      ) : vista === 'reclamos' ? (
        reclamos!.map((r) => (
          <View key={r.id} style={estilos.tarjeta}>
            <Titulo nivel={3}>{r.negocio_nombre}</Titulo>
            <Pressable onPress={() => Linking.openURL(urlInstagram(r.instagram_usuario))}>
              <Texto fuerte style={{ color: colores.naranjaOscuro }}>@{r.instagram_usuario}</Texto>
            </Pressable>
            <Texto>
              Lo reclama {r.user_nombre} · {r.email}
            </Texto>
            <Texto style={estilos.codigo}>{r.codigo}</Texto>
            <Texto suave style={{ fontSize: 14 }}>
              Vence en {diasRestantes(r.vence_at)} días · pedido el {fecha(r.created_at)}
            </Texto>
            <View style={estilos.acciones}>
              <Boton variante="secundario" onPress={() => resolverReclamo(r, false)} style={{ flex: 1 }}>
                Rechazar
              </Boton>
              <Boton onPress={() => resolverReclamo(r, true)} style={{ flex: 1 }}>
                Aprobar
              </Boton>
            </View>
          </View>
        ))
      ) : vista === 'bajas' ? (
        bajas!.map((b) => (
          <View key={b.id} style={estilos.tarjeta}>
            <Titulo nivel={3}>{b.negocio_nombre}</Titulo>
            <Pressable onPress={() => Linking.openURL(urlInstagram(b.instagram_usuario))}>
              <Texto fuerte style={{ color: colores.naranjaOscuro }}>@{b.instagram_usuario}</Texto>
            </Pressable>
            <Texto suave style={{ fontSize: 14 }}>
              {b.user_nombre ? `Lo pidió ${b.user_nombre}` : 'Lo ocultó el equipo'} · {fecha(b.created_at)}
            </Texto>
            {b.motivo ? <Texto>"{b.motivo}"</Texto> : null}
            <View style={estilos.acciones}>
              <Boton variante="secundario" onPress={() => resolverBaja(b, false)} style={{ flex: 1 }}>
                Devolver al mapa
              </Boton>
              {bajaEstado === 'pendiente' && (
                <Boton onPress={() => resolverBaja(b, true)} style={{ flex: 1 }}>
                  Confirmar
                </Boton>
              )}
            </View>
          </View>
        ))
      ) : vista === 'denuncias' ? (
        denuncias!.map((d) => (
          <View key={d.id} style={estilos.tarjeta}>
            <Texto fuerte>
              {MOTIVOS_DENUNCIA.find((m) => m.valor === d.reason)?.texto ?? d.reason} · {d.target_type}
            </Texto>
            <Texto suave style={{ fontSize: 14 }}>{fecha(d.created_at)}</Texto>
            {d.detail ? <Texto>"{d.detail}"</Texto> : null}
            {d.target_type === 'perfil' && (
              <Pressable onPress={() => router.push({ pathname: '/prestador/[id]', params: { id: d.target_id } })}>
                <Texto fuerte style={{ color: colores.naranjaOscuro }}>Ver perfil denunciado</Texto>
              </Pressable>
            )}
            {d.target_type === 'pedido' && (
              <Pressable onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: d.target_id } })}>
                <Texto fuerte style={{ color: colores.naranjaOscuro }}>Ver pedido denunciado</Texto>
              </Pressable>
            )}
            <View style={estilos.acciones}>
              <Boton variante="secundario" onPress={() => resolver(d, 'descartada')} style={{ flex: 1 }}>
                Descartar
              </Boton>
              <Boton onPress={() => resolver(d, 'revisada')} style={{ flex: 1 }}>
                Revisada
              </Boton>
            </View>
          </View>
        ))
      ) : (
        prestadores!.map((p) => (
          <View key={p.user_id} style={estilos.tarjeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
              <Avatar nombre={p.perfil?.full_name ?? '?'} url={p.perfil?.avatar_url} tam={48} />
              <View style={{ flex: 1 }}>
                <Titulo nivel={3}>{p.perfil?.full_name}</Titulo>
                <Texto suave style={{ fontSize: 14 }}>
                  {`desde ${fecha(p.created_at)}`}
                </Texto>
              </View>
            </View>
            <Texto fuerte style={{ fontSize: 14 }}>
              {p.provider_services.map((s) => categorias.find((c) => c.id === s.category_id)?.name).filter(Boolean).join(' · ') ||
                'Sin rubros'}
            </Texto>
            {p.bio ? <Texto>{p.bio}</Texto> : null}
            {p.price_range ? <Texto suave>Precios: {p.price_range}</Texto> : null}
            <View style={estilos.acciones}>
              {p.status !== 'suspendido' && (
                <Boton variante="peligro" onPress={() => estado(p, 'suspendido')} style={{ flex: 1 }}>
                  Suspender
                </Boton>
              )}
              {p.status !== 'aprobado' && (
                <Boton onPress={() => estado(p, 'aprobado')} style={{ flex: 1 }}>
                  Aprobar
                </Boton>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, gap: espacio.m, paddingBottom: espacio.xxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  tarjeta: { gap: espacio.s, padding: espacio.l, borderRadius: radio.l, borderWidth: 1, borderColor: colores.borde },
  acciones: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.xs },
  codigo: { fontSize: 32, letterSpacing: 5, textAlign: 'center', paddingVertical: espacio.xs },
})
