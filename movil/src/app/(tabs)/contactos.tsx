import * as Haptics from 'expo-haptics'
import { router, useFocusEffect } from 'expo-router'
import {
  Check,
  ChevronRight,
  Clock,
  Navigation,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { Avatar } from '../../components/Avatar'
import { AvisoEncuentro } from '../../components/AvisoEncuentro'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import {
  buscar,
  buscarHabilidadesCerca,
  cargarContactos,
  personasCerca,
  responder,
  solicitar,
  type Contacto,
  type PersonaCerca,
  type ResultadoBusqueda,
} from '../../lib/contactos'
import { textoDistancia } from '../../lib/datos'
import { misEncuentros, pedirEncuentro } from '../../lib/encuentros'
import { colores, espacio, fuentes, radio } from '../../theme'

type Pestania = 'contactos' | 'cerca' | 'solicitudes'

export default function Contactos() {
  const [lista, setLista] = useState<Contacto[]>([])
  const [cerca, setCerca] = useState<PersonaCerca[] | null>(null)
  const [pestania, setPestania] = useState<Pestania>('contactos')
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [resultadosHabilidad, setResultadosHabilidad] = useState<PersonaCerca[]>([])
  const [mensajeBusqueda, setMensajeBusqueda] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [cont, cerc] = await Promise.all([
        cargarContactos().catch(() => [] as Contacto[]),
        personasCerca().catch(() => [] as PersonaCerca[]),
      ])
      setLista(cont)
      setCerca(cerc)
    } catch {
      // Ignorar errores de red temporales
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )

  const onRefresh = useCallback(async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }, [cargar])

  const aceptados = useMemo(() => lista.filter((x) => x.estado === 'aceptado'), [lista])
  const recibidas = useMemo(() => lista.filter((x) => x.estado === 'recibida'), [lista])
  const enviadas = useMemo(() => lista.filter((x) => x.estado === 'enviada'), [lista])

  // Filtrado instantaneo de contactos propios por texto
  const contactosFiltrados = useMemo(() => {
    if (!q.trim()) return aceptados
    const needle = q.trim().toLowerCase()
    return aceptados.filter((c) => c.full_name.toLowerCase().includes(needle))
  }, [aceptados, q])

  async function hacerBuscar(texto: string) {
    setQ(texto)
    setMensajeBusqueda('')
    if (texto.trim().length < 2) {
      setResultados([])
      setResultadosHabilidad([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    try {
      // Personas por nombre/telefono (desde 3 letras) y gente cerca que sabe hacer lo que escribis.
      const [r, h] = await Promise.all([
        texto.trim().length >= 3 ? buscar(texto.trim()) : Promise.resolve([] as ResultadoBusqueda[]),
        buscarHabilidadesCerca(texto.trim()),
      ])
      setResultados(r)
      setResultadosHabilidad(h)
      if (r.length === 0 && h.length === 0) {
        setMensajeBusqueda('No encontramos a nadie con ese nombre, teléfono o habilidad cerca.')
      }
    } catch (e: any) {
      setResultados([])
      setResultadosHabilidad([])
      setMensajeBusqueda(`Error en la búsqueda: ${e.message}`)
    } finally {
      setBuscando(false)
    }
  }

  function limpiarBusqueda() {
    setQ('')
    setResultados([])
    setResultadosHabilidad([])
    setMensajeBusqueda('')
  }

  async function responderSolicitud(solicitudId: string, acepta: boolean) {
    try {
      Haptics.selectionAsync()
      setCargandoAccion(solicitudId)
      await responder(solicitudId, acepta)
      await cargar()
      if (q.trim().length >= 2) setResultadosHabilidad(await buscarHabilidadesCerca(q.trim()))
    } catch (e: any) {
      Alert.alert('No se pudo responder', e.message)
    } finally {
      setCargandoAccion(null)
    }
  }

  async function agregarUsuario(userId: string) {
    try {
      Haptics.selectionAsync()
      setCargandoAccion(userId)
      await solicitar(userId)
      Alert.alert('Solicitud enviada', 'Le avisamos a la otra persona para que acepte.')
      await cargar()
      if (q.trim().length >= 3) {
        setResultados(await buscar(q.trim()))
      }
      if (q.trim().length >= 2) setResultadosHabilidad(await buscarHabilidadesCerca(q.trim()))
    } catch (e: any) {
      Alert.alert('No se pudo enviar la solicitud', e.message)
    } finally {
      setCargandoAccion(null)
    }
  }

  async function voyParaAlla(userId: string) {
    try {
      Haptics.selectionAsync()
      const abiertos = await misEncuentros()
      const existente = abiertos.find((x) => x.otro_id === userId)
      const encuentro = existente ? existente.id : await pedirEncuentro(userId)
      router.push({ pathname: '/encuentro/[id]', params: { id: encuentro } })
    } catch (e: any) {
      Alert.alert('No se pudo iniciar el encuentro', e.message)
    }
  }

  const enModoBusqueda = q.trim().length > 0

  return (
    <RequiereLogin
      icono={Users}
      titulo="Tus contactos"
      texto="Entrá para agregar vecinos y compartir ubicación si querés."
    >
      <View style={estilos.contenedor}>
        {/* Cabecera y buscador fijos */}
        <View style={estilos.cabecera}>
          <AvisoEncuentro />

          <View style={estilos.filaTitulo}>
            <Titulo>Contactos</Titulo>
            <View style={estilos.badgeTotal}>
              <Texto fuerte style={estilos.textoBadgeTotal}>
                {aceptados.length}
              </Texto>
            </View>
          </View>

          {/* Campo de búsqueda moderno */}
          <View style={estilos.cajaBuscador}>
            <Search size={18} color={colores.texto2} style={estilos.iconoBuscador} />
            <TextInput
              value={q}
              onChangeText={hacerBuscar}
              placeholder="Buscar por nombre o teléfono"
              placeholderTextColor={colores.texto2}
              style={estilos.inputBuscador}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {q.length > 0 && (
              <Pressable
                onPress={limpiarBusqueda}
                style={estilos.botonLimpiarBusqueda}
                accessibilityLabel="Borrar búsqueda"
              >
                <X size={16} color={colores.texto2} />
              </Pressable>
            )}
          </View>

          {/* Segmented control / pestañas (solo visible si no estamos buscando) */}
          {!enModoBusqueda && (
            <View style={estilos.filaPestanias} accessibilityRole="tablist">
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: pestania === 'contactos' }}
                onPress={() => {
                  Haptics.selectionAsync()
                  setPestania('contactos')
                }}
                style={[
                  estilos.pestania,
                  pestania === 'contactos' && estilos.pestaniaActiva,
                ]}
              >
                <Texto
                  fuerte
                  style={[
                    estilos.textoPestania,
                    pestania === 'contactos' && estilos.textoPestaniaActiva,
                  ]}
                >
                  Contactos ({aceptados.length})
                </Texto>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: pestania === 'cerca' }}
                onPress={() => {
                  Haptics.selectionAsync()
                  setPestania('cerca')
                }}
                style={[
                  estilos.pestania,
                  pestania === 'cerca' && estilos.pestaniaActiva,
                ]}
              >
                <Texto
                  fuerte
                  style={[
                    estilos.textoPestania,
                    pestania === 'cerca' && estilos.textoPestaniaActiva,
                  ]}
                >
                  Cerca ({cerca?.length ?? 0})
                </Texto>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: pestania === 'solicitudes' }}
                onPress={() => {
                  Haptics.selectionAsync()
                  setPestania('solicitudes')
                }}
                style={[
                  estilos.pestania,
                  pestania === 'solicitudes' && estilos.pestaniaActiva,
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Texto
                    fuerte
                    style={[
                      estilos.textoPestania,
                      pestania === 'solicitudes' && estilos.textoPestaniaActiva,
                    ]}
                  >
                    Solicitudes
                  </Texto>
                  {recibidas.length > 0 && (
                    <View style={estilos.puntoAlerta}>
                      <Texto style={estilos.textoPuntoAlerta}>{recibidas.length}</Texto>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          )}
        </View>

        {/* Aviso rápido de solicitudes pendientes si estamos en otra pestaña */}
        {!enModoBusqueda && pestania !== 'solicitudes' && recibidas.length > 0 && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync()
              setPestania('solicitudes')
            }}
            style={estilos.bannerSolicitudPendiente}
          >
            <View style={estilos.iconoCampanaMini}>
              <UserCheck size={18} color={colores.naranjaOscuro} />
            </View>
            <View style={{ flex: 1 }}>
              <Texto fuerte style={{ fontSize: 13, color: colores.tinta }}>
                {recibidas.length === 1
                  ? 'Tenés 1 solicitud de contacto pendiente'
                  : `Tenés ${recibidas.length} solicitudes de contacto pendientes`}
              </Texto>
              <Texto suave style={{ fontSize: 12 }}>
                Tocá para ver y responder
              </Texto>
            </View>
            <ChevronRight size={18} color={colores.texto2} />
          </Pressable>
        )}

        {/* Contenido principal según la vista activa */}
        {enModoBusqueda ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={estilos.scrollContenido}
            data={resultados}
            keyExtractor={(x) => `res-${x.user_id}`}
            ListHeaderComponent={
              <View style={{ gap: espacio.m, marginBottom: espacio.s }}>
                {/* Contactos locales que coinciden */}
                {contactosFiltrados.length > 0 && (
                  <View style={{ gap: espacio.s }}>
                    <Texto suave fuerte style={estilos.subtituloSeccion}>
                      TUS CONTACTOS ({contactosFiltrados.length})
                    </Texto>
                    {contactosFiltrados.map((c) => (
                      <TarjetaContacto
                        key={c.user_id}
                        contacto={c}
                        onVoyParaAlla={() => voyParaAlla(c.user_id)}
                        onVerPerfil={() =>
                          router.push({
                            pathname: '/persona/[id]',
                            params: { id: c.user_id },
                          })
                        }
                      />
                    ))}
                  </View>
                )}

                {/* Gente cerca que sabe hacer lo que se busca (habilidades) */}
                {resultadosHabilidad.length > 0 && (
                  <View style={{ gap: espacio.s }}>
                    <Texto suave fuerte style={estilos.subtituloSeccion}>
                      CERCA TUYO QUE PUEDEN AYUDARTE ({resultadosHabilidad.length})
                    </Texto>
                    {resultadosHabilidad.map((p) => (
                      <TarjetaPersonaCerca
                        key={`hab-${p.user_id}`}
                        persona={p}
                        cargando={cargandoAccion === p.user_id}
                        onAgregar={() => agregarUsuario(p.user_id)}
                        onVerPerfil={() =>
                          router.push({ pathname: '/persona/[id]', params: { id: p.user_id } })
                        }
                      />
                    ))}
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Texto suave fuerte style={estilos.subtituloSeccion}>
                    EN CERCAYA
                  </Texto>
                  {buscando && <ActivityIndicator size="small" color={colores.naranjaOscuro} />}
                </View>

                {q.trim().length < 3 && (
                  <Texto suave style={{ fontSize: 13 }}>
                    Escribí al menos 3 letras para buscar personas en toda la app.
                  </Texto>
                )}

                {mensajeBusqueda !== '' && (
                  <View style={estilos.tarjetaVacia}>
                    <Texto suave style={{ textAlign: 'center' }}>
                      {mensajeBusqueda}
                    </Texto>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <TarjetaResultadoBusqueda
                item={item}
                cargando={cargandoAccion === item.user_id}
                onAgregar={() => agregarUsuario(item.user_id)}
                onVerPerfil={() =>
                  router.push({
                    pathname: '/persona/[id]',
                    params: { id: item.user_id },
                  })
                }
              />
            )}
          />
        ) : pestania === 'contactos' ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refrescando}
                onRefresh={onRefresh}
                colors={[colores.naranjaOscuro]}
              />
            }
            contentContainerStyle={estilos.scrollContenido}
            data={aceptados}
            keyExtractor={(x) => x.user_id}
            ListEmptyComponent={
              <View style={estilos.vacioContenedor}>
                <View style={estilos.vacioIcono}>
                  <Users size={32} color={colores.naranjaOscuro} />
                </View>
                <Titulo nivel={3} style={{ textAlign: 'center' }}>
                  Todavía no tenés contactos
                </Titulo>
                <Texto suave style={{ textAlign: 'center', maxWidth: 280, fontSize: 14 }}>
                  Podés buscar amigos por nombre o ver a los vecinos que están cerca para empezar a conectar.
                </Texto>
                <Boton
                  variante="marca"
                  onPress={() => setPestania('cerca')}
                  style={{ marginTop: espacio.s }}
                >
                  Ver vecinos cerca
                </Boton>
              </View>
            }
            renderItem={({ item }) => (
              <TarjetaContacto
                contacto={item}
                onVoyParaAlla={() => voyParaAlla(item.user_id)}
                onVerPerfil={() =>
                  router.push({
                    pathname: '/persona/[id]',
                    params: { id: item.user_id },
                  })
                }
              />
            )}
          />
        ) : pestania === 'cerca' ? (
          <FlatList
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refrescando}
                onRefresh={onRefresh}
                colors={[colores.naranjaOscuro]}
              />
            }
            contentContainerStyle={estilos.scrollContenido}
            data={cerca ?? []}
            keyExtractor={(x) => x.user_id}
            ListEmptyComponent={
              <View style={estilos.vacioContenedor}>
                <View style={estilos.vacioIcono}>
                  <Users size={32} color={colores.naranjaOscuro} />
                </View>
                <Titulo nivel={3} style={{ textAlign: 'center' }}>
                  No hay vecinos visibles cerca
                </Titulo>
                <Texto suave style={{ textAlign: 'center', maxWidth: 280, fontSize: 14 }}>
                  Para que otros vecinos te encuentren en esta lista, recordá activar "Mostrar mi ubicación a todos" en tu Perfil.
                </Texto>
                <Boton
                  variante="secundario"
                  onPress={() => router.push('/(tabs)/perfil')}
                  style={{ marginTop: espacio.s }}
                >
                  Ir a mi perfil
                </Boton>
              </View>
            }
            renderItem={({ item }) => (
              <TarjetaPersonaCerca
                persona={item}
                cargando={cargandoAccion === item.user_id}
                onAgregar={() => agregarUsuario(item.user_id)}
                onVerPerfil={() =>
                  router.push({
                    pathname: '/persona/[id]',
                    params: { id: item.user_id },
                  })
                }
              />
            )}
          />
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refrescando}
                onRefresh={onRefresh}
                colors={[colores.naranjaOscuro]}
              />
            }
            contentContainerStyle={estilos.scrollContenido}
            data={recibidas}
            keyExtractor={(x) => x.user_id}
            ListHeaderComponent={
              recibidas.length > 0 ? (
                <Texto suave fuerte style={estilos.subtituloSeccion}>
                  SOLICITUDES RECIBIDAS ({recibidas.length})
                </Texto>
              ) : null
            }
            ListEmptyComponent={
              enviadas.length === 0 ? (
                <View style={estilos.vacioContenedor}>
                  <View style={estilos.vacioIcono}>
                    <UserCheck size={32} color={colores.naranjaOscuro} />
                  </View>
                  <Titulo nivel={3} style={{ textAlign: 'center' }}>
                    Sin solicitudes pendientes
                  </Titulo>
                  <Texto suave style={{ textAlign: 'center', maxWidth: 280, fontSize: 14 }}>
                    Cuando alguien te envíe una solicitud de contacto, te va a aparecer acá para que la aceptes.
                  </Texto>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TarjetaSolicitudRecibida
                solicitud={item}
                cargando={cargandoAccion === item.contact_id}
                onAceptar={() => responderSolicitud(item.contact_id, true)}
                onRechazar={() => responderSolicitud(item.contact_id, false)}
                onVerPerfil={() =>
                  router.push({
                    pathname: '/persona/[id]',
                    params: { id: item.user_id },
                  })
                }
              />
            )}
            ListFooterComponent={
              enviadas.length > 0 ? (
                <View style={{ gap: espacio.s, marginTop: espacio.l }}>
                  <Texto suave fuerte style={estilos.subtituloSeccion}>
                    SOLICITUDES ENVIADAS ({enviadas.length})
                  </Texto>
                  {enviadas.map((e) => (
                    <TarjetaSolicitudEnviada
                      key={e.user_id}
                      item={e}
                      onVerPerfil={() =>
                        router.push({
                          pathname: '/persona/[id]',
                          params: { id: e.user_id },
                        })
                      }
                    />
                  ))}
                </View>
              ) : null
            }
          />
        )}
      </View>
    </RequiereLogin>
  )
}

// -----------------------------------------------------------------------------
// Componentes de Tarjeta de la Lista
// -----------------------------------------------------------------------------

function TarjetaContacto({
  contacto,
  onVoyParaAlla,
  onVerPerfil,
}: {
  contacto: Contacto
  onVoyParaAlla: () => void
  onVerPerfil: () => void
}) {
  return (
    <Pressable onPress={onVerPerfil} style={estilos.tarjetaItem}>
      <Avatar nombre={contacto.full_name} url={contacto.avatar_url} tam={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto fuerte style={{ fontSize: 15 }} numberOfLines={1}>
          {contacto.full_name}
        </Texto>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={[estilos.puntoVerde, { backgroundColor: colores.exito }]} />
          <Texto suave style={{ fontSize: 12 }}>
            Contacto
          </Texto>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voy para allá con ${contacto.full_name}`}
        onPress={onVoyParaAlla}
        style={estilos.botonAccionRapida}
      >
        <Navigation size={18} color={colores.naranjaOscuro} />
        <Texto fuerte style={{ fontSize: 12, color: colores.naranjaOscuro }}>
          Ir
        </Texto>
      </Pressable>
    </Pressable>
  )
}

function TarjetaPersonaCerca({
  persona,
  cargando,
  onAgregar,
  onVerPerfil,
}: {
  persona: PersonaCerca
  cargando: boolean
  onAgregar: () => void
  onVerPerfil: () => void
}) {
  const distanciaYBarrio = [persona.zona, textoDistancia(persona.distancia_km), persona.oficios?.join(', ')]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable onPress={onVerPerfil} style={estilos.tarjetaItemCerca}>
      <View style={estilos.filaSuperiorCerca}>
        <Avatar nombre={persona.full_name} url={persona.avatar_url} tam={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Texto fuerte style={{ fontSize: 15 }} numberOfLines={1}>
              {persona.full_name}
            </Texto>
            <View style={estilos.badgeCerca}>
              <Texto fuerte style={estilos.textoBadgeCerca}>
                Cerca
              </Texto>
            </View>
          </View>
          {distanciaYBarrio ? (
            <Texto suave style={{ fontSize: 12 }} numberOfLines={1}>
              {distanciaYBarrio}
            </Texto>
          ) : null}
        </View>

        {persona.estado === 'enviada' ? (
          <View style={estilos.badgeEstadoPendiente}>
            <Clock size={13} color={colores.texto2} />
            <Texto suave style={{ fontSize: 12 }}>
              Enviada
            </Texto>
          </View>
        ) : persona.estado === 'recibida' ? (
          <Boton
            variante="secundario"
            onPress={onVerPerfil}
            style={estilos.botonCompacto}
          >
            Responder
          </Boton>
        ) : (
          <Boton
            variante="marca"
            icono={UserPlus}
            cargando={cargando}
            onPress={onAgregar}
            style={estilos.botonCompacto}
          >
            Agregar
          </Boton>
        )}
      </View>

      {/* Oficios si están disponibles */}
      {persona.oficios && persona.oficios.length > 0 && (
        <View style={estilos.filaOficios}>
          {persona.oficios.slice(0, 3).map((o) => (
            <View key={o} style={estilos.chipOficio}>
              <Texto style={{ fontSize: 11, color: colores.tinta }}>{o}</Texto>
            </View>
          ))}
          {persona.oficios.length > 3 && (
            <Texto suave style={{ fontSize: 11, alignSelf: 'center' }}>
              +{persona.oficios.length - 3}
            </Texto>
          )}
        </View>
      )}
    </Pressable>
  )
}

function TarjetaSolicitudRecibida({
  solicitud,
  cargando,
  onAceptar,
  onRechazar,
  onVerPerfil,
}: {
  solicitud: Contacto
  cargando: boolean
  onAceptar: () => void
  onRechazar: () => void
  onVerPerfil: () => void
}) {
  return (
    <View style={estilos.tarjetaSolicitud}>
      <Pressable onPress={onVerPerfil} style={estilos.filaInfoSolicitud}>
        <Avatar nombre={solicitud.full_name} url={solicitud.avatar_url} tam={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto fuerte style={{ fontSize: 15 }} numberOfLines={1}>
            {solicitud.full_name}
          </Texto>
          <Texto suave style={{ fontSize: 12 }}>
            Te envió una solicitud de contacto
          </Texto>
        </View>
      </Pressable>

      <View style={estilos.filaAccionesSolicitud}>
        <Boton
          variante="marca"
          icono={Check}
          cargando={cargando}
          onPress={onAceptar}
          style={estilos.botonMitad}
        >
          Aceptar
        </Boton>
        <Boton
          variante="secundario"
          icono={X}
          deshabilitado={cargando}
          onPress={onRechazar}
          style={estilos.botonMitad}
        >
          Rechazar
        </Boton>
      </View>
    </View>
  )
}

function TarjetaSolicitudEnviada({
  item,
  onVerPerfil,
}: {
  item: Contacto
  onVerPerfil: () => void
}) {
  return (
    <Pressable onPress={onVerPerfil} style={estilos.tarjetaItem}>
      <Avatar nombre={item.full_name} url={item.avatar_url} tam={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto fuerte style={{ fontSize: 15 }} numberOfLines={1}>
          {item.full_name}
        </Texto>
        <Texto suave style={{ fontSize: 12 }}>
          Esperando que acepte tu solicitud
        </Texto>
      </View>
      <View style={estilos.badgeEstadoPendiente}>
        <Clock size={13} color={colores.texto2} />
        <Texto suave style={{ fontSize: 12 }}>
          Pendiente
        </Texto>
      </View>
    </Pressable>
  )
}

function TarjetaResultadoBusqueda({
  item,
  cargando,
  onAgregar,
  onVerPerfil,
}: {
  item: ResultadoBusqueda
  cargando: boolean
  onAgregar: () => void
  onVerPerfil: () => void
}) {
  return (
    <Pressable onPress={onVerPerfil} style={estilos.tarjetaItem}>
      <Avatar nombre={item.full_name} url={item.avatar_url} tam={46} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto fuerte style={{ fontSize: 15 }} numberOfLines={1}>
          {item.full_name}
        </Texto>
        <Texto suave style={{ fontSize: 12 }}>
          {item.estado === 'aceptado'
            ? 'Ya es tu contacto'
            : item.estado === 'enviada'
            ? 'Solicitud pendiente'
            : item.estado === 'recibida'
            ? 'Te envió una solicitud'
            : 'En CercaYa'}
        </Texto>
      </View>

      {item.estado === 'aceptado' ? (
        <View style={estilos.badgeVerdeContacto}>
          <Check size={14} color={colores.exito} />
          <Texto style={{ fontSize: 12, color: colores.exito }}>Contacto</Texto>
        </View>
      ) : item.estado === 'enviada' ? (
        <View style={estilos.badgeEstadoPendiente}>
          <Clock size={13} color={colores.texto2} />
          <Texto suave style={{ fontSize: 12 }}>
            Enviada
          </Texto>
        </View>
      ) : item.estado === 'recibida' ? (
        <Boton variante="secundario" onPress={onVerPerfil} style={estilos.botonCompacto}>
          Responder
        </Boton>
      ) : (
        <Boton
          variante="marca"
          icono={UserPlus}
          cargando={cargando}
          onPress={onAgregar}
          style={estilos.botonCompacto}
        >
          Agregar
        </Boton>
      )}
    </Pressable>
  )
}

// -----------------------------------------------------------------------------
// Estilos
// -----------------------------------------------------------------------------

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  cabecera: {
    paddingHorizontal: espacio.l,
    paddingTop: espacio.m,
    paddingBottom: espacio.s,
    backgroundColor: colores.fondo,
    gap: espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
  },
  badgeTotal: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radio.full,
    backgroundColor: colores.naranjaSuave,
  },
  textoBadgeTotal: {
    fontSize: 13,
    color: colores.naranjaOscuro,
  },
  cajaBuscador: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.grupo,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  iconoBuscador: {
    marginRight: 8,
  },
  inputBuscador: {
    flex: 1,
    fontFamily: fuentes.texto,
    fontSize: 15,
    color: colores.tinta,
    paddingVertical: 8,
  },
  botonLimpiarBusqueda: {
    padding: 6,
    borderRadius: radio.full,
  },
  filaPestanias: {
    flexDirection: 'row',
    backgroundColor: colores.grupo,
    borderRadius: radio.m,
    padding: 3,
    gap: 4,
  },
  pestania: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radio.s,
  },
  pestaniaActiva: {
    backgroundColor: colores.fondo,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  textoPestania: {
    fontSize: 13,
    color: colores.texto2,
  },
  textoPestaniaActiva: {
    color: colores.naranjaOscuro,
  },
  puntoAlerta: {
    backgroundColor: colores.peligro,
    borderRadius: radio.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoPuntoAlerta: {
    fontSize: 10,
    color: colores.blanco,
    fontFamily: fuentes.textoFuerte,
  },
  bannerSolicitudPendiente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.naranjaSuave,
    paddingHorizontal: espacio.l,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  iconoCampanaMini: {
    width: 32,
    height: 32,
    borderRadius: radio.full,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContenido: {
    padding: espacio.l,
    gap: espacio.m,
    paddingBottom: espacio.xxl,
  },
  subtituloSeccion: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tarjetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.fondo,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tarjetaItemCerca: {
    backgroundColor: colores.fondo,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: espacio.s,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filaSuperiorCerca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
  },
  badgeCerca: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radio.full,
    backgroundColor: '#EFF6FF',
  },
  textoBadgeCerca: {
    fontSize: 11,
    color: '#1D4ED8',
  },
  filaOficios: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 56,
  },
  chipOficio: {
    backgroundColor: colores.grupo,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radio.full,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  tarjetaSolicitud: {
    backgroundColor: colores.fondo,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: espacio.m,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filaInfoSolicitud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
  },
  filaAccionesSolicitud: {
    flexDirection: 'row',
    gap: espacio.s,
  },
  botonAccionRapida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colores.naranjaSuave,
    borderRadius: radio.full,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  botonCompacto: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radio.full,
  },
  botonMitad: {
    flex: 1,
    minHeight: 42,
  },
  puntoVerde: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  badgeEstadoPendiente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radio.full,
    backgroundColor: colores.grupo,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  badgeVerdeContacto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radio.full,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  vacioContenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espacio.xxl,
    paddingHorizontal: espacio.l,
    gap: espacio.s,
  },
  vacioIcono: {
    width: 64,
    height: 64,
    borderRadius: radio.full,
    backgroundColor: colores.naranjaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.s,
  },
  tarjetaVacia: {
    padding: espacio.l,
    borderRadius: radio.m,
    backgroundColor: colores.grupo,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
