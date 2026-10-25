import * as Haptics from 'expo-haptics'
import { router, useFocusEffect } from 'expo-router'
import {
  Crosshair,
  MapPinned,
  Navigation,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { Avatar, iniciales } from '../../components/Avatar'
import { AvisoEncuentro } from '../../components/AvisoEncuentro'
import { InterruptoresUbicacion } from '../../components/InterruptoresUbicacion'
import { MapaTrabajo } from '../../components/MapaTrabajo'
import { SelectorModo, type ModoMapa } from '../../components/SelectorModo'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import {
  cargarMapa,
  personasCerca,
  solicitar,
  type ContactoMapa,
  type PersonaCerca,
} from '../../lib/contactos'
import { useCompartirUbicacion } from '../../lib/compartirUbicacion'
import { textoDistancia } from '../../lib/datos'
import { misEncuentros, pedirEncuentro } from '../../lib/encuentros'
import { textoHace } from '../../lib/tiempo'
import { useUbicacion } from '../../lib/ubicacion'
import { colores, espacio, fuentes, radio } from '../../theme'

const REFRESCO_MS = 60_000

type FiltroMapa = 'todos' | 'contactos' | 'cerca'
type PersonaSeleccionada =
  | { tipo: 'contacto'; data: ContactoMapa }
  | { tipo: 'cerca'; data: PersonaCerca }

const CLAVE_MODO = 'cercaya.modoMapa'

function modoGuardado(): ModoMapa {
  try {
    return localStorage.getItem(CLAVE_MODO) === 'trabajo' ? 'trabajo' : 'amigos'
  } catch {
    return 'amigos'
  }
}

// Interruptor Amigos | Trabajo: el mapa de siempre, o el buscador de servicios.
export default function Mapa() {
  const [modo, setModo] = useState<ModoMapa>(modoGuardado)
  const cambiar = (m: ModoMapa) => {
    setModo(m)
    localStorage.setItem(CLAVE_MODO, m)
  }
  const selector = <SelectorModo modo={modo} onCambiar={cambiar} />
  if (modo === 'trabajo') {
    return (
      <RequiereLogin
        icono={MapPinned}
        titulo="Buscá quién te ayuda"
        texto="Entrá para ver quién cerca puede resolver lo que necesitás."
      >
        <MapaTrabajo selector={selector} />
      </RequiereLogin>
    )
  }
  return <MapaAmigos selector={selector} />
}

function MapaAmigos({ selector }: { selector: ReactNode }) {
  const { origen } = useUbicacion()
  const { compartiendo, publico } = useCompartirUbicacion()

  const [contactos, setContactos] = useState<ContactoMapa[]>([])
  const [cerca, setCerca] = useState<PersonaCerca[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoAccion, setCargandoAccion] = useState(false)
  const [error, setError] = useState('')

  const [filtro, setFiltro] = useState<FiltroMapa>('todos')
  const [seleccionado, setSeleccionado] = useState<PersonaSeleccionada | null>(null)
  const [modalPrivacidad, setModalPrivacidad] = useState(false)
  const [avisoVacioDescartado, setAvisoVacioDescartado] = useState(false)

  const mapaRef = useRef<MapView>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    Promise.all([
      cargarMapa()
        .then((c) => {
          setContactos(c)
          setError('')
        })
        .catch((e) => setError(e.message)),
      personasCerca()
        .then(setCerca)
        .catch(() => setCerca([])),
    ]).finally(() => setCargando(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      cargar()
      const intervalo = setInterval(cargar, REFRESCO_MS)
      return () => clearInterval(intervalo)
    }, [cargar, compartiendo, publico]),
  )

  function centrarEnMi() {
    Haptics.selectionAsync()
    mapaRef.current?.animateToRegion(
      {
        latitude: origen.lat,
        longitude: origen.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      350,
    )
  }

  function seleccionarItem(item: PersonaSeleccionada, lat: number, lng: number) {
    Haptics.selectionAsync()
    setSeleccionado(item)
    const offsetLat = 0.007
    mapaRef.current?.animateToRegion(
      {
        latitude: lat - offsetLat,
        longitude: lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      300,
    )
  }

  async function voyParaAlla(id: string) {
    try {
      setCargandoAccion(true)
      const abiertos = await misEncuentros()
      const existente = abiertos.find((x) => x.otro_id === id)
      const encuentro = existente ? existente.id : await pedirEncuentro(id)
      router.push({ pathname: '/encuentro/[id]', params: { id: encuentro } })
    } catch (e: any) {
      Alert.alert('No se pudo iniciar el encuentro', e.message)
    } finally {
      setCargandoAccion(false)
    }
  }

  async function agregarContacto(id: string) {
    try {
      setCargandoAccion(true)
      await solicitar(id)
      Alert.alert('Solicitud enviada', 'Le avisamos a la otra persona para que acepte.')
      setCerca((prev) =>
        prev.map((p) => (p.user_id === id ? { ...p, estado: 'enviada' as const } : p)),
      )
      if (seleccionado && seleccionado.tipo === 'cerca' && seleccionado.data.user_id === id) {
        setSeleccionado({
          tipo: 'cerca',
          data: { ...seleccionado.data, estado: 'enviada' },
        })
      }
    } catch (e: any) {
      Alert.alert('No se pudo enviar la solicitud', e.message)
    } finally {
      setCargandoAccion(false)
    }
  }

  const total = contactos.length + cerca.length
  const mostrarContactos = filtro === 'todos' || filtro === 'contactos'
  const mostrarCerca = filtro === 'todos' || filtro === 'cerca'
  const sinNadie = contactos.length === 0 && cerca.length === 0

  return (
    <RequiereLogin
      icono={MapPinned}
      titulo="Tu mapa"
      texto="Entrá para ver a tus contactos y a la gente que está cerca."
    >
      <View style={estilos.contenedor}>
        {/* Mapa full-screen */}
        <MapView
          ref={mapaRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: origen.lat,
            longitude: origen.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={() => setSeleccionado(null)}
        >
          {mostrarContactos &&
            contactos.map((c) => {
              const lat = Number(c.lat)
              const lng = Number(c.lng)
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
              const estaSeleccionado = seleccionado?.data.user_id === c.user_id
              return (
                <Marker
                  key={`c-${c.user_id}`}
                  coordinate={{ latitude: lat, longitude: lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => seleccionarItem({ tipo: 'contacto', data: c }, lat, lng)}
                >
                  <MarcadorPin
                    nombre={c.full_name}
                    avatarUrl={c.avatar_url}
                    tipo="contacto"
                    desactualizada={c.desactualizada}
                    seleccionado={estaSeleccionado}
                  />
                </Marker>
              )
            })}

          {mostrarCerca &&
            cerca.map((p) => {
              const lat = Number(p.lat)
              const lng = Number(p.lng)
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
              const estaSeleccionado = seleccionado?.data.user_id === p.user_id
              return (
                <Marker
                  key={`p-${p.user_id}`}
                  coordinate={{ latitude: lat, longitude: lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => seleccionarItem({ tipo: 'cerca', data: p }, lat, lng)}
                >
                  <MarcadorPin
                    nombre={p.full_name}
                    avatarUrl={p.avatar_url}
                    tipo="cerca"
                    seleccionado={estaSeleccionado}
                  />
                </Marker>
              )
            })}
        </MapView>

        {/* Barra superior unificada: Segmented control + Botón de privacidad */}
        <View style={estilos.barraSuperior}>
          <View style={estilos.segmentado}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === 'todos' }}
              onPress={() => {
                Haptics.selectionAsync()
                setFiltro('todos')
              }}
              style={[estilos.itemSegmento, filtro === 'todos' && estilos.itemSegmentoActivo]}
            >
              <Texto
                fuerte={filtro === 'todos'}
                style={[estilos.textoSegmento, filtro === 'todos' && estilos.textoSegmentoActivo]}
              >
                Todos{total > 0 ? ` (${total})` : ''}
              </Texto>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === 'contactos' }}
              onPress={() => {
                Haptics.selectionAsync()
                setFiltro('contactos')
              }}
              style={[estilos.itemSegmento, filtro === 'contactos' && estilos.itemSegmentoActivo]}
            >
              <Texto
                fuerte={filtro === 'contactos'}
                style={[
                  estilos.textoSegmento,
                  filtro === 'contactos' && estilos.textoSegmentoActivo,
                ]}
              >
                Contactos{contactos.length > 0 ? ` (${contactos.length})` : ''}
              </Texto>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === 'cerca' }}
              onPress={() => {
                Haptics.selectionAsync()
                setFiltro('cerca')
              }}
              style={[estilos.itemSegmento, filtro === 'cerca' && estilos.itemSegmentoActivo]}
            >
              <Texto
                fuerte={filtro === 'cerca'}
                style={[estilos.textoSegmento, filtro === 'cerca' && estilos.textoSegmentoActivo]}
              >
                Cerca{cerca.length > 0 ? ` (${cerca.length})` : ''}
              </Texto>
            </Pressable>
          </View>

          {/* Botón de visibilidad / privacidad */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajustes de visibilidad en el mapa"
            onPress={() => {
              Haptics.selectionAsync()
              setModalPrivacidad(true)
            }}
            style={estilos.botonPrivacidad}
          >
            <Shield size={18} color={colores.tinta} />
            {compartiendo || publico ? (
              <View
                style={[estilos.puntoEstadoPrivacidad, { backgroundColor: colores.exito }]}
              />
            ) : null}
          </Pressable>
        </View>

        {selector}

        {/* Micro aviso flotante si el mapa está vacío, sutil y descartable */}
        {sinNadie && !cargando && !seleccionado && !avisoVacioDescartado && (
          <View style={estilos.avisoVacioMini}>
            <Users size={14} color={colores.texto2} />
            <Texto suave style={{ fontSize: 12 }}>
              Sin personas en el mapa
            </Texto>
            <View style={estilos.puntoSeparador} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/contactos')}
              hitSlop={8}
            >
              <Texto fuerte style={{ fontSize: 12, color: colores.naranjaOscuro }}>
                Buscar
              </Texto>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ocultar aviso"
              onPress={() => setAvisoVacioDescartado(true)}
              hitSlop={8}
              style={{ marginLeft: 2 }}
            >
              <X size={13} color={colores.texto2} />
            </Pressable>
          </View>
        )}

        {/* Banner de aviso de encuentro si hay alguno en curso */}
        <View style={estilos.contenedorAvisoEncuentro} pointerEvents="box-none">
          <AvisoEncuentro />
        </View>

        {/* Botón flotante para centrar mapa en mi posición */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Centrar en mi ubicación"
          onPress={centrarEnMi}
          style={[estilos.fabGps, seleccionado ? estilos.fabGpsArriba : null]}
        >
          <Crosshair size={20} color={colores.tinta} />
        </Pressable>

        {/* Detalle flotante de la persona seleccionada */}
        {seleccionado && (
          <View style={estilos.contenedorDetalle}>
            <TarjetaPersona
              item={seleccionado}
              onCerrar={() => setSeleccionado(null)}
              onVoyParaAlla={() => voyParaAlla(seleccionado.data.user_id)}
              onVerPerfil={() =>
                router.push({
                  pathname: '/persona/[id]',
                  params: { id: seleccionado.data.user_id },
                })
              }
              onAgregar={() => agregarContacto(seleccionado.data.user_id)}
              cargandoAccion={cargandoAccion}
            />
          </View>
        )}

        {/* Error discreto si falla la carga */}
        {!!error && (
          <View style={estilos.bannerError}>
            <Texto suave style={{ fontSize: 13, color: colores.peligro, flex: 1 }}>
              No pudimos actualizar el mapa: {error}
            </Texto>
            <Pressable onPress={cargar}>
              <Texto fuerte style={{ fontSize: 13, color: colores.naranjaOscuro }}>
                Reintentar
              </Texto>
            </Pressable>
          </View>
        )}

        {/* Modal de Privacidad y Ajustes de Ubicación */}
        <Modal
          visible={modalPrivacidad}
          transparent
          animationType="slide"
          onRequestClose={() => setModalPrivacidad(false)}
        >
          <Pressable style={estilos.modalOverlay} onPress={() => setModalPrivacidad(false)}>
            <Pressable style={estilos.modalContenido} onPress={(e) => e.stopPropagation()}>
              <View style={estilos.modalCabecera}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                  <Shield size={22} color={colores.naranjaOscuro} />
                  <Titulo nivel={3}>Tu visibilidad en el mapa</Titulo>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar ventana de visibilidad"
                  onPress={() => setModalPrivacidad(false)}
                  style={estilos.botonCerrarModal}
                >
                  <X size={20} color={colores.texto2} />
                </Pressable>
              </View>

              <Texto suave style={{ fontSize: 14, lineHeight: 20 }}>
                Elegí con quién querés compartir tu posición. En el mapa público la ubicación
                siempre es aproximada (~300 m para contactos, tu barrio para los demás). Tu punto
                exacto nunca se revela.
              </Texto>

              <InterruptoresUbicacion />

              <Boton
                variante="primario"
                onPress={() => {
                  setModalPrivacidad(false)
                  cargar()
                }}
                style={{ marginTop: espacio.s }}
              >
                Listo
              </Boton>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </RequiereLogin>
  )
}

function MarcadorPin({
  nombre,
  avatarUrl,
  tipo,
  desactualizada,
  seleccionado,
}: {
  nombre: string
  avatarUrl?: string | null
  tipo: 'contacto' | 'cerca'
  desactualizada?: boolean
  seleccionado?: boolean
}) {
  const esContacto = tipo === 'contacto'
  const colorBorde = esContacto ? colores.naranja : '#2563EB'
  const colorFondo = esContacto ? colores.naranjaSuave : '#EFF6FF'
  const inicial = iniciales(nombre)

  return (
    <View
      style={[
        estilosPin.contenedor,
        desactualizada && { opacity: 0.65 },
        seleccionado && estilosPin.contenedorSeleccionado,
      ]}
    >
      <View
        style={[
          estilosPin.burbuja,
          { borderColor: colorBorde, backgroundColor: colorFondo },
          seleccionado && { borderColor: colorBorde, borderWidth: 3 },
        ]}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={estilosPin.avatar} resizeMode="cover" />
        ) : (
          <Text
            style={[
              estilosPin.inicial,
              { color: esContacto ? colores.naranjaOscuro : '#1E40AF' },
            ]}
          >
            {inicial}
          </Text>
        )}
      </View>
    </View>
  )
}

function TarjetaPersona({
  item,
  onCerrar,
  onVoyParaAlla,
  onVerPerfil,
  onAgregar,
  cargandoAccion,
}: {
  item: PersonaSeleccionada
  onCerrar: () => void
  onVoyParaAlla: () => void
  onVerPerfil: () => void
  onAgregar: () => void
  cargandoAccion: boolean
}) {
  const esContacto = item.tipo === 'contacto'
  const nombre = item.data.full_name
  const avatarUrl = item.data.avatar_url

  const subtitulo =
    item.tipo === 'contacto'
      ? item.data.desactualizada
        ? 'Ubicación anterior (+30 min)'
        : `Actualizado ${textoHace(item.data.actualizada_at)}`
      : [item.data.zona, textoDistancia(item.data.distancia_km)].filter(Boolean).join(' · ')

  const oficios = item.tipo === 'cerca' ? item.data.oficios : []
  const estado = item.tipo === 'cerca' ? item.data.estado : null

  return (
    <View style={estilosTarjeta.tarjeta}>
      {/* Tirador decorativo de sheet */}
      <View style={estilosTarjeta.tirador} />

      {/* Cabecera */}
      <View style={estilosTarjeta.filaCabecera}>
        <Avatar nombre={nombre} url={avatarUrl} tam={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Titulo nivel={3} numberOfLines={1} style={{ flexShrink: 1, fontSize: 16 }}>
              {nombre}
            </Titulo>
            <View
              style={[
                estilosTarjeta.badge,
                { backgroundColor: esContacto ? colores.naranjaSuave : '#EFF6FF' },
              ]}
            >
              <Texto
                fuerte
                style={[
                  estilosTarjeta.badgeTexto,
                  { color: esContacto ? colores.naranjaOscuro : '#1D4ED8' },
                ]}
              >
                {esContacto ? 'Contacto' : 'Cerca tuyo'}
              </Texto>
            </View>
          </View>
          <Texto suave style={{ fontSize: 12 }} numberOfLines={1}>
            {subtitulo}
          </Texto>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar detalle"
          onPress={onCerrar}
          hitSlop={8}
          style={estilosTarjeta.botonCerrar}
        >
          <X size={16} color={colores.texto2} />
        </Pressable>
      </View>

      {/* Oficios si es gente cerca */}
      {oficios.length > 0 && (
        <View style={estilosTarjeta.filaOficios}>
          {oficios.slice(0, 3).map((o) => (
            <View key={o} style={estilosTarjeta.chipOficio}>
              <Texto style={{ fontSize: 11, color: colores.tinta }}>{o}</Texto>
            </View>
          ))}
          {oficios.length > 3 && (
            <Texto suave style={{ fontSize: 11, alignSelf: 'center' }}>
              +{oficios.length - 3}
            </Texto>
          )}
        </View>
      )}

      {/* Botones de acción directa */}
      <View style={estilosTarjeta.filaAcciones}>
        {esContacto ? (
          <>
            <Boton
              variante="primario"
              icono={Navigation}
              cargando={cargandoAccion}
              onPress={onVoyParaAlla}
              style={estilosTarjeta.botonAccion}
            >
              Voy para allá
            </Boton>
            <Boton
              variante="secundario"
              icono={User}
              onPress={onVerPerfil}
              style={estilosTarjeta.botonAccion}
            >
              Ver perfil
            </Boton>
          </>
        ) : (
          <>
            <Boton
              variante="primario"
              icono={User}
              onPress={onVerPerfil}
              style={estilosTarjeta.botonAccion}
            >
              Ver perfil
            </Boton>
            {estado === null && (
              <Boton
                variante="secundario"
                icono={UserPlus}
                cargando={cargandoAccion}
                onPress={onAgregar}
                style={estilosTarjeta.botonAccion}
              >
                Agregar
              </Boton>
            )}
            {estado === 'enviada' && (
              <Boton variante="secundario" deshabilitado style={estilosTarjeta.botonAccion}>
                Enviada
              </Boton>
            )}
            {estado === 'recibida' && (
              <Boton variante="secundario" onPress={onVerPerfil} style={estilosTarjeta.botonAccion}>
                Responder
              </Boton>
            )}
          </>
        )}
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.fondo },
  barraSuperior: {
    position: 'absolute',
    top: 56, // debajo del selector Amigos | Trabajo
    left: espacio.m,
    right: espacio.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
  },
  segmentado: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.fondo,
    borderRadius: radio.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  itemSegmento: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: radio.full,
  },
  itemSegmentoActivo: {
    backgroundColor: colores.naranjaSuave,
  },
  textoSegmento: {
    fontSize: 12,
    color: colores.texto2,
    fontFamily: fuentes.textoMedio,
  },
  textoSegmentoActivo: {
    color: colores.naranjaOscuro,
    fontFamily: fuentes.textoFuerte,
  },
  botonPrivacidad: {
    width: 38,
    height: 38,
    borderRadius: radio.full,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  puntoEstadoPrivacidad: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  avisoVacioMini: {
    position: 'absolute',
    top: 102, // debajo de la barra (selector + filtros)
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.fondo,
    borderRadius: radio.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  puntoSeparador: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colores.texto2,
    opacity: 0.5,
  },
  contenedorAvisoEncuentro: {
    position: 'absolute',
    top: 102, // debajo de la barra (selector + filtros)
    left: espacio.m,
    right: espacio.m,
  },
  fabGps: {
    position: 'absolute',
    right: espacio.m,
    bottom: espacio.l,
    width: 42,
    height: 42,
    borderRadius: radio.full,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabGpsArriba: {
    bottom: 210,
  },
  contenedorDetalle: {
    position: 'absolute',
    bottom: espacio.m,
    left: espacio.m,
    right: espacio.m,
  },
  bannerError: {
    position: 'absolute',
    top: 102, // debajo de la barra (selector + filtros)
    left: espacio.m,
    right: espacio.m,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radio.m,
    padding: espacio.s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContenido: {
    backgroundColor: colores.fondo,
    borderTopLeftRadius: radio.l,
    borderTopRightRadius: radio.l,
    padding: espacio.l,
    gap: espacio.m,
  },
  modalCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonCerrarModal: {
    width: 36,
    height: 36,
    borderRadius: radio.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.grupo,
  },
})

const estilosPin = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  contenedorSeleccionado: {
    transform: [{ scale: 1.15 }],
  },
  burbuja: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondo,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  inicial: {
    fontFamily: fuentes.titulo,
    fontSize: 12,
  },
})

const estilosTarjeta = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.fondo,
    borderRadius: 20,
    padding: espacio.m,
    gap: espacio.s,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tirador: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 2,
  },
  filaCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radio.full,
  },
  badgeTexto: {
    fontSize: 11,
  },
  botonCerrar: {
    width: 28,
    height: 28,
    borderRadius: radio.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.grupo,
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
  filaAcciones: {
    flexDirection: 'row',
    gap: espacio.s,
    marginTop: 2,
  },
  botonAccion: {
    flex: 1,
    minHeight: 44,
  },
})
