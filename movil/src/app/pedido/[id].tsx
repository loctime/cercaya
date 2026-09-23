import * as Location from 'expo-location'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { BadgeCheck, CalendarDays, Clock, EllipsisVertical, MapPin, MessageCircle, Star } from 'lucide-react-native'
import { useCallback, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../../components/Avatar'
import { EstadoBadge } from '../../components/Chip'
import { Calificacion } from '../../components/Estrellas'
import { iconoDe } from '../../components/IconoCategoria'
import { Boton, Campo, Texto, Titulo } from '../../components/ui'
import { abrirChat } from '../../lib/contacto'
import { fecha, textoDistancia, useCategorias } from '../../lib/datos'
import { CAMPOS_PEDIDO, textoUrgencia, urlsFotosPedido, type Pedido } from '../../lib/pedidos'
import { useSesion } from '../../lib/sesion'
import { supabase } from '../../lib/supabase'
import { colores, espacio, radio } from '../../theme'

type Persona = { id: string; full_name: string; avatar_url: string | null }
type Interesado = { id: string; provider_id: string; message: string | null; created_at: string; provider: Persona | null }
type Checkin = { arrived_at: string; arrive_distance_m: number; left_at: string | null }

type Datos = {
  pedido: Pedido
  cliente: Persona | null
  clienteRating: { promedio: number | null; cantidad: number }
  asignado: Persona | null
  interesados: Interesado[]
  fotos: string[]
  distancia: number | null
  checkin: Checkin | null
  yaCalifique: boolean
  puedoOfrecerme: boolean
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

async function cargarDatos(id: string, yo: string): Promise<Datos | null> {
  const { data: pedido } = await supabase.from('jobs').select(CAMPOS_PEDIDO).eq('id', id).maybeSingle()
  if (!pedido) return null
  const p = pedido as Pedido
  const esCliente = p.client_id === yo

  const [cliente, rating, asignado, interesados, fotos, distancia, checkin, mia, miPerfil] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').eq('id', p.client_id).maybeSingle(),
    supabase.from('reviews').select('rating').eq('reviewee_id', p.client_id).eq('rol_calificado', 'cliente'),
    p.assigned_provider_id
      ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', p.assigned_provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('applications')
      .select('id, provider_id, message, created_at, provider:profiles!applications_provider_id_fkey(id, full_name, avatar_url)')
      .eq('job_id', id)
      .order('created_at'),
    urlsFotosPedido(id),
    esCliente ? Promise.resolve({ data: null }) : supabase.rpc('distancia_a_pedido', { p_job: id }),
    supabase.from('job_checkins').select('arrived_at, arrive_distance_m, left_at').eq('job_id', id).maybeSingle(),
    supabase.from('reviews').select('id').eq('job_id', id).eq('reviewer_id', yo),
    supabase.from('provider_profiles').select('status, provider_services(category_id)').eq('user_id', yo).maybeSingle(),
  ])

  const notas = (rating.data ?? []).map((r) => r.rating as number)
  return {
    pedido: p,
    cliente: cliente.data,
    clienteRating: {
      promedio: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
      cantidad: notas.length,
    },
    asignado: asignado.data,
    interesados: (interesados.data as unknown as Interesado[]) ?? [],
    fotos,
    distancia: (distancia.data as number | null) ?? null,
    checkin: checkin.data,
    yaCalifique: (mia.data ?? []).length > 0,
    puedoOfrecerme:
      miPerfil.data?.status === 'aprobado' &&
      (miPerfil.data.provider_services as { category_id: number }[]).some((s) => s.category_id === p.category_id),
  }
}

export default function DetallePedido() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { sesion } = useSesion()
  const categorias = useCategorias()
  const yo = sesion?.user.id ?? ''
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined)
  const [ocupado, setOcupado] = useState('')
  const [mensaje, setMensaje] = useState('')

  const recargar = useCallback(async () => {
    if (!yo) return
    setDatos(await cargarDatos(id, yo))
  }, [id, yo])

  useFocusEffect(
    useCallback(() => {
      recargar()
    }, [recargar]),
  )

  // Ejecuta una accion del servidor y recarga; los errores del servidor ya vienen en castellano.
  async function accion(nombre: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    setOcupado(nombre)
    const { error } = await fn()
    setOcupado('')
    if (error) return Alert.alert('No se pudo completar', error.message)
    if (ok) Alert.alert(ok)
    recargar()
  }

  if (datos === undefined) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={colores.naranjaOscuro} />
      </View>
    )
  }
  if (datos === null) {
    return (
      <View style={[estilos.centro, { padding: espacio.xl }]}>
        <Texto style={{ textAlign: 'center' }}>Este pedido ya no está disponible.</Texto>
      </View>
    )
  }

  const { pedido: p } = datos
  const esCliente = p.client_id === yo
  const soyAsignado = p.assigned_provider_id === yo
  const meOfreci = datos.interesados.some((i) => i.provider_id === yo)
  const abierto = p.status === 'abierto' || p.status === 'en_conversacion'
  const cat = categorias.find((c) => c.id === p.category_id)
  const Icono = cat ? iconoDe(cat.icon) : null
  const verificado =
    datos.checkin &&
    datos.checkin.arrive_distance_m <= 150 &&
    datos.checkin.left_at &&
    new Date(datos.checkin.left_at).getTime() - new Date(datos.checkin.arrived_at).getTime() >= 10 * 60 * 1000

  function menu() {
    const opciones: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = []
    if (esCliente && p.status !== 'cerrado' && p.status !== 'cancelado') {
      opciones.push({
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Cancelar pedido', 'Los interesados dejan de verlo. No se puede deshacer.', [
            { text: 'Volver', style: 'cancel' },
            {
              text: 'Cancelar pedido',
              style: 'destructive',
              onPress: () => accion('cancelar', () => supabase.rpc('cancelar_pedido', { p_job: id })),
            },
          ]),
      })
    }
    if (!esCliente) {
      opciones.push({
        text: 'Denunciar pedido',
        onPress: () => router.push({ pathname: '/denunciar', params: { tipo: 'pedido', id } }),
      })
    }
    opciones.push({ text: 'Cerrar', style: 'cancel' })
    Alert.alert(p.title, undefined, opciones)
  }

  async function marcarLlegada(tipo: 'checkin' | 'checkout') {
    setOcupado(tipo)
    const permiso = await Location.requestForegroundPermissionsAsync()
    if (!permiso.granted) {
      setOcupado('')
      return Alert.alert('Necesitamos tu ubicación', 'Para registrar la llegada tenés que permitir la ubicación.')
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setOcupado('')
      await accion(
        tipo,
        () => supabase.rpc(tipo, { p_job: id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude }),
        tipo === 'checkin' ? 'Listo, avisamos al cliente que llegaste.' : 'Registramos tu salida.',
      )
    } catch {
      setOcupado('')
      Alert.alert('No pudimos obtener tu ubicación', 'Probá de nuevo en unos segundos.')
    }
  }

  // ------------------------------------------------------------------
  // Acciones segun rol y estado
  // ------------------------------------------------------------------
  let acciones: ReactNode = null

  if (esCliente) {
    if (p.status === 'asignado' || p.status === 'realizado') {
      acciones = p.client_confirmed_at ? (
        <Texto suave style={{ textAlign: 'center' }}>
          Confirmaste el trabajo. Falta que {datos.asignado?.full_name.split(' ')[0]} lo marque como realizado.
        </Texto>
      ) : (
        <Boton
          onPress={() =>
            Alert.alert('Confirmar trabajo', 'Confirmás que el trabajo quedó bien y que el pago está acordado?', [
              { text: 'Todavía no', style: 'cancel' },
              { text: 'Confirmar', onPress: () => accion('confirmar', () => supabase.rpc('confirmar_trabajo', { p_job: id })) },
            ])
          }
          cargando={ocupado === 'confirmar'}
        >
          Pago recibido / Trabajo conforme
        </Boton>
      )
    }
  } else if (soyAsignado) {
    if (p.status === 'asignado') {
      acciones = (
        <View style={{ gap: espacio.s }}>
          {!datos.checkin ? (
            <Boton variante="secundario" icono={MapPin} onPress={() => marcarLlegada('checkin')} cargando={ocupado === 'checkin'}>
              Llegué
            </Boton>
          ) : !datos.checkin.left_at ? (
            <Boton variante="secundario" icono={MapPin} onPress={() => marcarLlegada('checkout')} cargando={ocupado === 'checkout'}>
              Me voy
            </Boton>
          ) : null}
          <Boton
            onPress={() =>
              Alert.alert('Trabajo realizado', 'Le avisamos al cliente para que confirme.', [
                { text: 'Volver', style: 'cancel' },
                { text: 'Marcar realizado', onPress: () => accion('realizado', () => supabase.rpc('marcar_realizado', { p_job: id })) },
              ])
            }
            cargando={ocupado === 'realizado'}
          >
            Marcar trabajo realizado
          </Boton>
        </View>
      )
    }
  } else if (abierto) {
    acciones = meOfreci ? (
      <Boton
        icono={MessageCircle}
        onPress={async () => {
          setOcupado('chat')
          await abrirChat(p.client_id, id)
          setOcupado('')
        }}
        cargando={ocupado === 'chat'}
      >
        Chatear con el cliente
      </Boton>
    ) : !datos.puedoOfrecerme ? (
      <Texto suave style={{ textAlign: 'center' }}>
        Para ofrecerte en pedidos de {cat?.name.toLowerCase() ?? 'este rubro'} sumá ese servicio desde tu perfil.
      </Texto>
    ) : (
      <View style={{ gap: espacio.s }}>
        <Campo
          etiqueta="Mensaje para el cliente (opcional)"
          placeholder="Hola, puedo pasar hoy a la tarde..."
          value={mensaje}
          onChangeText={setMensaje}
          maxLength={500}
        />
        <Boton
          onPress={async () => {
            setOcupado('interesa')
            const { data, error } = await supabase.rpc('me_interesa', { p_job: id, p_message: mensaje.trim() || null })
            setOcupado('')
            if (error) return Alert.alert('No se pudo completar', error.message)
            router.push({ pathname: '/chat/[id]', params: { id: data as string } })
          }}
          cargando={ocupado === 'interesa'}
        >
          Me interesa
        </Boton>
      </View>
    )
  }

  if (p.status === 'cerrado' && (esCliente || soyAsignado)) {
    const otro = esCliente ? datos.asignado : datos.cliente
    acciones = datos.yaCalifique ? (
      <Texto suave style={{ textAlign: 'center' }}>Ya dejaste tu calificación. Gracias!</Texto>
    ) : otro ? (
      <Boton
        icono={Star}
        onPress={() =>
          router.push({
            pathname: '/calificar',
            params: { job: id, nombre: otro.full_name, rol: esCliente ? 'prestador' : 'cliente', verificado: verificado ? '1' : '' },
          })
        }
      >
        Calificar a {otro.full_name.split(' ')[0]}
      </Boton>
    ) : null
  }

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () =>
            (esCliente && p.status !== 'cerrado' && p.status !== 'cancelado') || !esCliente ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Más opciones" hitSlop={10} onPress={menu}>
                <EllipsisVertical size={22} color={colores.tinta} />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: espacio.l, gap: espacio.xl, paddingBottom: 200 }}>
        <View style={{ gap: espacio.s }}>
          <EstadoBadge estado={p.status} />
          <Titulo>{p.title}</Titulo>
          <View style={estilos.meta}>
            {Icono && cat && <Meta icono={<Icono size={16} color={colores.texto2} />} texto={cat.name} />}
            <Meta
              icono={<MapPin size={16} color={colores.texto2} />}
              texto={[p.zone_label, datos.distancia != null ? textoDistancia(datos.distancia) : null].filter(Boolean).join(', ')}
            />
            <Meta icono={<Clock size={16} color={colores.texto2} />} texto={textoUrgencia(p.urgency)} />
            {p.preferred_date && (
              <Meta icono={<CalendarDays size={16} color={colores.texto2} />} texto={`Preferido: ${fecha(p.preferred_date + 'T12:00:00')}`} />
            )}
          </View>
          <Texto suave style={{ fontSize: 13 }}>Publicado el {fecha(p.created_at)}</Texto>
        </View>

        {!esCliente && datos.cliente && (
          <View style={estilos.persona}>
            <Avatar nombre={datos.cliente.full_name} url={datos.cliente.avatar_url} tam={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Texto fuerte>{datos.cliente.full_name}</Texto>
              <Calificacion promedio={datos.clienteRating.promedio} cantidad={datos.clienteRating.cantidad} />
            </View>
          </View>
        )}

        <Texto>{p.description}</Texto>

        {datos.fotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
            {datos.fotos.map((url) => (
              <Image key={url} source={{ uri: url }} style={estilos.foto} />
            ))}
          </ScrollView>
        )}

        {/* Prestador asignado (lo ven las dos partes) */}
        {datos.asignado && (esCliente || soyAsignado) && (
          <View style={{ gap: espacio.s }}>
            <Titulo nivel={3}>{esCliente ? 'Quién hace el trabajo' : 'Trabajo asignado a vos'}</Titulo>
            {esCliente && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/prestador/[id]', params: { id: datos.asignado!.id } })}
                style={estilos.persona}
              >
                <Avatar nombre={datos.asignado.full_name} url={datos.asignado.avatar_url} tam={44} />
                <Texto fuerte style={{ flex: 1 }}>{datos.asignado.full_name}</Texto>
              </Pressable>
            )}
            <Boton
              variante="secundario"
              icono={MessageCircle}
              onPress={() => abrirChat(esCliente ? datos.asignado!.id : p.client_id, id)}
            >
              Abrir chat
            </Boton>
            {datos.checkin && (
              <View style={estilos.aviso}>
                <BadgeCheck size={18} color={colores.exito} />
                <Texto style={{ flex: 1, fontSize: 14 }}>
                  Llegó a las {hora(datos.checkin.arrived_at)}
                  {datos.checkin.left_at ? ` y se fue a las ${hora(datos.checkin.left_at)}` : ''}.
                  {verificado ? ' Este trabajo cuenta como verificado.' : ''}
                </Texto>
              </View>
            )}
          </View>
        )}

        {/* Interesados: solo el cliente, mientras esta abierto */}
        {esCliente && abierto && (
          <View style={{ gap: espacio.s }}>
            <Titulo nivel={3}>Interesados</Titulo>
            {datos.interesados.length === 0 ? (
              <Texto suave>
                Todavía nadie se ofreció. Avisamos a los prestadores de {cat?.name.toLowerCase() ?? 'este rubro'} de tu zona.
              </Texto>
            ) : (
              datos.interesados.map((i) =>
                i.provider ? (
                  <View key={i.id} style={estilos.interesado}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/prestador/[id]', params: { id: i.provider_id } })}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}
                    >
                      <Avatar nombre={i.provider.full_name} url={i.provider.avatar_url} tam={44} />
                      <View style={{ flex: 1 }}>
                        <Texto fuerte>{i.provider.full_name}</Texto>
                        <Texto suave style={{ fontSize: 13 }}>Ver perfil</Texto>
                      </View>
                    </Pressable>
                    {i.message ? <Texto>"{i.message}"</Texto> : null}
                    <View style={{ flexDirection: 'row', gap: espacio.s }}>
                      <Boton variante="secundario" icono={MessageCircle} onPress={() => abrirChat(i.provider_id, id)} style={{ flex: 1 }}>
                        Chat
                      </Boton>
                      <Boton
                        onPress={() =>
                          Alert.alert(`Asignar a ${i.provider!.full_name}`, 'Los demás interesados dejan de ver el pedido.', [
                            { text: 'Volver', style: 'cancel' },
                            {
                              text: 'Asignar',
                              onPress: () =>
                                accion('asignar', () => supabase.rpc('asignar_prestador', { p_job: id, p_provider: i.provider_id })),
                            },
                          ])
                        }
                        cargando={ocupado === 'asignar'}
                        style={{ flex: 1 }}
                      >
                        Asignar
                      </Boton>
                    </View>
                  </View>
                ) : null,
              )
            )}
          </View>
        )}

        {!esCliente && !soyAsignado && !abierto && (
          <View style={estilos.aviso}>
            <Texto style={{ flex: 1 }}>Este pedido ya tiene quien lo haga.</Texto>
          </View>
        )}
      </ScrollView>

      {acciones && (
        <View style={[estilos.barra, { paddingBottom: insets.bottom + espacio.m }]}>{acciones}</View>
      )}
    </View>
  )
}

function Meta({ icono, texto }: { icono: ReactNode; texto: string }) {
  if (!texto) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icono}
      <Texto suave style={{ fontSize: 14 }}>{texto}</Texto>
    </View>
  )
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo },
  meta: { gap: 6 },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.m,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
  },
  foto: { width: 160, height: 160, borderRadius: radio.m, backgroundColor: colores.grupo },
  interesado: { gap: espacio.s, padding: espacio.m, borderRadius: radio.m, borderWidth: 1, borderColor: colores.borde },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
  },
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: espacio.l,
    paddingTop: espacio.m,
    backgroundColor: colores.fondo,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    gap: espacio.s,
  },
})

