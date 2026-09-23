import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { Boton, Texto, Titulo } from '../components/ui'
import { fecha, useCategorias } from '../lib/datos'
import { MOTIVOS_DENUNCIA } from '../lib/moderacion'
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

type Vista = 'pendiente' | 'aprobado' | 'suspendido' | 'denuncias'

// Panel de administracion: aprobar prestadores y revisar denuncias.
// Solo lo ven usuarios con is_admin (la base lo vuelve a chequear).
export default function Admin() {
  const { perfil } = useSesion()
  const categorias = useCategorias()
  const [vista, setVista] = useState<Vista>('pendiente')
  const [prestadores, setPrestadores] = useState<Prestador[] | null>(null)
  const [denuncias, setDenuncias] = useState<Denuncia[] | null>(null)

  const cargar = useCallback(async () => {
    if (vista === 'denuncias') {
      const { data } = await supabase
        .from('reports')
        .select('id, target_type, target_id, reason, detail, created_at')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: false })
      setDenuncias(data ?? [])
    } else {
      const { data } = await supabase
        .from('provider_profiles')
        .select('user_id, bio, price_range, status, created_at, perfil:profiles!provider_profiles_user_id_fkey(full_name, avatar_url, zone_label), provider_services(category_id)')
        .eq('status', vista)
        .order('created_at', { ascending: false })
      setPrestadores((data as unknown as Prestador[]) ?? [])
    }
  }, [vista])

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

  const lista = vista === 'denuncias' ? denuncias : prestadores

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.chips}>
        {(
          [
            ['pendiente', 'Por aprobar'],
            ['aprobado', 'Aprobados'],
            ['suspendido', 'Suspendidos'],
            ['denuncias', 'Denuncias'],
          ] as const
        ).map(([v, t]) => (
          <Chip
            key={v}
            activo={vista === v}
            onPress={() => {
              setPrestadores(null)
              setDenuncias(null)
              setVista(v)
            }}
          >
            {t}
          </Chip>
        ))}
      </View>

      {lista === null ? (
        <ActivityIndicator color={colores.naranjaOscuro} />
      ) : lista.length === 0 ? (
        <Texto suave style={{ textAlign: 'center', marginTop: espacio.xl }}>No hay nada acá.</Texto>
      ) : vista === 'denuncias' ? (
        denuncias!.map((d) => (
          <View key={d.id} style={estilos.tarjeta}>
            <Texto fuerte>
              {MOTIVOS_DENUNCIA.find((m) => m.valor === d.reason)?.texto ?? d.reason} · {d.target_type}
            </Texto>
            <Texto suave style={{ fontSize: 13 }}>{fecha(d.created_at)}</Texto>
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
                <Texto suave style={{ fontSize: 13 }}>
                  {[p.perfil?.zone_label, `desde ${fecha(p.created_at)}`].filter(Boolean).join(' · ')}
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
})
