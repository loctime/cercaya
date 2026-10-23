import * as Device from 'expo-device'
import { router, useLocalSearchParams } from 'expo-router'
import {
  ArrowUp,
  Check,
  ExternalLink,
  MapPinned,
  MessageCircle,
  Navigation,
  X,
} from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { Avatar, iniciales } from '../../components/Avatar'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import { abrirChat } from '../../lib/contacto'
import {
  misEncuentros,
  responderEncuentro,
  terminarEncuentro,
  type EncuentroResumen,
  type EstadoEncuentro,
} from '../../lib/encuentros'
import { textoCardinal, textoDistancia } from '../../lib/geo'
import { useSesion } from '../../lib/sesion'
import { textoHace } from '../../lib/tiempo'
import { useEncuentro } from '../../lib/useEncuentro'
import { colores, espacio, fuentes, radio } from '../../theme'

const SIN_SENAL_MS = 2 * 60 * 1000

// Marcas que cierran apps en segundo plano si no se las excluye del ahorro de bateria
const AGRESIVAS = /xiaomi|redmi|poco|huawei|honor|oppo|realme|vivo|oneplus/i
const esAgresiva = !!Device.manufacturer && AGRESIVAS.test(Device.manufacturer)

const MENSAJE_FINAL: Partial<Record<EstadoEncuentro, string>> = {
  terminado: 'El encuentro terminó.',
  rechazado: 'No se aceptó el encuentro.',
  vencido: 'No respondieron a tiempo.',
}

// Pantalla del encuentro ("Voy para alla"): pedir, aceptar y verse en vivo.
export default function Encuentro() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { sesion } = useSesion()
  const [resumen, setResumen] = useState<EncuentroResumen | null>(null)
  const [cargandoChat, setCargandoChat] = useState(false)
  const { estado, yo, otro, rumbo, giro, distanciaM, llegaron, error, refrescar } = useEncuentro(
    id,
    resumen?.otro_nombre,
    resumen?.soy_solicitante,
  )
  const mapa = useRef<MapView>(null)

  // Cargar resumen del encuentro para saber contraparte y rol
  useEffect(() => {
    misEncuentros()
      .then((lista) => {
        const mio = lista.find((x) => x.id === id)
        if (mio) setResumen(mio)
      })
      .catch(() => {})
  }, [id, estado?.estado])

  // Ajustar mapa para que entren ambas personas
  useEffect(() => {
    if (!yo || !otro) return
    mapa.current?.fitToCoordinates(
      [
        { latitude: yo.lat, longitude: yo.lng },
        { latitude: otro.lat, longitude: otro.lng },
      ],
      { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true },
    )
  }, [yo?.lat, yo?.lng, otro?.lat, otro?.lng])

  const nombre = resumen?.otro_nombre ?? 'tu contacto'
  const primerNombre = nombre.split(' ')[0]

  async function accion(fn: () => Promise<unknown>, volver = false) {
    try {
      await fn()
      if (volver) router.back()
      else refrescar()
    } catch (e: any) {
      Alert.alert('No se pudo completar', e.message)
    }
  }

  function comoLlegar() {
    if (!otro) return
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${otro.lat},${otro.lng}`)
  }

  async function irAlChat() {
    if (!resumen?.otro_id) return
    setCargandoChat(true)
    try {
      await abrirChat(resumen.otro_id)
    } finally {
      setCargandoChat(false)
    }
  }

  const final = estado && MENSAJE_FINAL[estado.estado]
  const sinSenal =
    estado?.otro_at != null && Date.now() - new Date(estado.otro_at).getTime() > SIN_SENAL_MS

  return (
    <RequiereLogin
      icono={MapPinned}
      titulo="Voy para allá"
      texto="Entrá para compartir tu ubicación con tus contactos."
    >
      <ScrollView contentContainerStyle={estilos.contenido}>
        {/* Cabecera del encuentro */}
        <View style={estilos.cabecera}>
          <Avatar nombre={nombre} url={resumen?.otro_avatar} tam={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Titulo nivel={2}>{nombre}</Titulo>
            {resumen?.estado === 'activo' && resumen.ends_at && (
              <Texto suave style={{ fontSize: 13 }}>
                Compartiendo hasta las {new Date(resumen.ends_at).toTimeString().slice(0, 5)}
              </Texto>
            )}
          </View>

          {/* Acceso rapido al chat si el encuentro esta activo o pendiente */}
          {resumen?.otro_id && !final && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir chat con ${primerNombre}`}
              onPress={irAlChat}
              style={estilos.botonChatRapido}
            >
              <MessageCircle size={20} color={colores.tinta} />
            </Pressable>
          )}
        </View>

        {error !== '' && (
          <View style={estilos.bannerError}>
            <Texto style={{ color: colores.peligro, fontSize: 13 }}>{error}</Texto>
          </View>
        )}

        {estado === null && error === '' && (
          <View style={estilos.cajaConectando}>
            <Texto suave>Conectando encuentro en vivo…</Texto>
          </View>
        )}

        {/* Estado finalizado */}
        {final && (
          <View style={estilos.cajaFinal}>
            <Titulo nivel={3}>{final}</Titulo>
            <Texto suave style={{ textAlign: 'center', fontSize: 14 }}>
              Las ubicaciones exactas ya fueron eliminadas de la sesión.
            </Texto>
            <Boton variante="secundario" onPress={() => router.back()} style={{ marginTop: espacio.s }}>
              Volver
            </Boton>
          </View>
        )}

        {/* Destinatario esperando aceptar o rechazar */}
        {estado?.estado === 'pendiente' && resumen && !resumen.soy_solicitante && (
          <View style={estilos.tarjetaAccionPendiente}>
            <Texto style={{ fontSize: 15, lineHeight: 22 }}>
              {primerNombre} va para allá y te pidió compartir ubicación exacta en vivo hasta encontrarse.
            </Texto>
            <View style={estilos.filaBotones}>
              <Boton
                variante="marca"
                icono={Check}
                onPress={() => accion(() => responderEncuentro(id, true))}
                style={estilos.botonMitad}
              >
                Aceptar
              </Boton>
              <Boton
                variante="secundario"
                icono={X}
                onPress={() => accion(() => responderEncuentro(id, false), true)}
                style={estilos.botonMitad}
              >
                Rechazar
              </Boton>
            </View>
          </View>
        )}

        {/* Solicitante esperando respuesta */}
        {estado?.estado === 'pendiente' && resumen?.soy_solicitante && (
          <View style={estilos.tarjetaAccionPendiente}>
            <Texto style={{ fontSize: 15, lineHeight: 22 }}>
              Esperando que {primerNombre} acepte tu pedido. Si no responde en 15 minutos, se cancela solo.
            </Texto>
            <Boton
              variante="secundario"
              onPress={() => accion(() => terminarEncuentro(id), true)}
            >
              Cancelar pedido
            </Boton>
          </View>
        )}

        {/* Modo activo en vivo */}
        {estado?.estado === 'activo' && (
          <>
            {/* Banner de llegada */}
            {llegaron && (
              <View style={estilos.llegaron}>
                <View style={estilos.iconoCheckLlegaron}>
                  <Check size={22} color={colores.exito} />
                </View>
                <View style={{ flex: 1 }}>
                  <Titulo nivel={3}>Llegaron</Titulo>
                  <Texto suave style={{ fontSize: 13 }}>
                    Están a menos de 50 metros de distancia.
                  </Texto>
                </View>
              </View>
            )}

            {/* Mapa en vivo con pines estilizados */}
            <View style={estilos.contenedorMapa}>
              <MapView
                ref={mapa}
                style={estilos.mapa}
                initialRegion={{
                  latitude: yo?.lat ?? otro?.lat ?? -33.4833,
                  longitude: yo?.lng ?? otro?.lng ?? -60.0167,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                showsCompass={false}
                toolbarEnabled={false}
              >
                {yo && (
                  <Marker
                    coordinate={{ latitude: yo.lat, longitude: yo.lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    title="Vos"
                  >
                    <PinMarcadorSimple
                      nombre={sesion?.user.user_metadata?.full_name ?? 'Vos'}
                      avatarUrl={sesion?.user.user_metadata?.avatar_url}
                      esPropio
                    />
                  </Marker>
                )}
                {otro && (
                  <Marker
                    coordinate={{ latitude: otro.lat, longitude: otro.lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    title={nombre}
                    opacity={sinSenal ? 0.55 : 1}
                  >
                    <PinMarcadorSimple
                      nombre={nombre}
                      avatarUrl={resumen?.otro_avatar}
                      esPropio={false}
                    />
                  </Marker>
                )}
              </MapView>

              {/* Boton para re-enfocar el mapa a los dos */}
              {yo && otro && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enfocar ambos en el mapa"
                  onPress={() =>
                    mapa.current?.fitToCoordinates(
                      [
                        { latitude: yo.lat, longitude: yo.lng },
                        { latitude: otro.lat, longitude: otro.lng },
                      ],
                      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
                    )
                  }
                  style={estilos.botonReenfocar}
                >
                  <Navigation size={18} color={colores.naranjaOscuro} />
                </Pressable>
              )}
            </View>

            {/* Brújula y distancia */}
            {otro && distanciaM != null ? (
              <View style={estilos.tarjetaBrujula}>
                <View
                  style={[
                    estilos.circuloFlecha,
                    giro != null && { transform: [{ rotate: `${giro}deg` }] },
                  ]}
                >
                  <ArrowUp size={38} color={colores.tinta} strokeWidth={2.8} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Titulo nivel={1} style={{ fontSize: 30, color: colores.naranjaOscuro }}>
                    {textoDistancia(distanciaM)}
                  </Titulo>
                  <Texto fuerte style={{ fontSize: 14 }}>
                    {rumbo != null ? `Hacia el ${textoCardinal(rumbo)}` : 'Calculando rumbo…'}
                  </Texto>
                  {estado.otro_at && (
                    <Texto suave style={{ fontSize: 12 }}>
                      {sinSenal
                        ? `Sin señal de ${primerNombre} desde ${textoHace(estado.otro_at)}`
                        : `Posición de ${primerNombre} ${textoHace(estado.otro_at)}`}
                    </Texto>
                  )}
                </View>
              </View>
            ) : (
              <View style={estilos.tarjetaEsperandoGPS}>
                <Texto suave style={{ textAlign: 'center' }}>
                  Esperando las coordenadas de {primerNombre}…
                </Texto>
              </View>
            )}

            {/* Botones de acción */}
            <View style={estilos.filaAcciones}>
              {otro && (
                <Boton
                  variante="primario"
                  icono={ExternalLink}
                  onPress={comoLlegar}
                  style={estilos.botonMitad}
                >
                  Cómo llegar
                </Boton>
              )}
              {resumen?.otro_id && (
                <Boton
                  variante="secundario"
                  icono={MessageCircle}
                  cargando={cargandoChat}
                  onPress={irAlChat}
                  style={estilos.botonMitad}
                >
                  Chat
                </Boton>
              )}
            </View>

            <Boton
              variante="peligro"
              onPress={() => accion(() => terminarEncuentro(id))}
              style={{ marginTop: espacio.xs }}
            >
              Terminar encuentro
            </Boton>

            <View style={estilos.cajaAvisos}>
              <Texto suave style={{ fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                Podés apagar la pantalla o guardar el celular: el servicio sigue transmitiendo
                hasta que cualquiera de los dos termine el encuentro.
              </Texto>
              {esAgresiva && (
                <Texto suave style={{ fontSize: 11, lineHeight: 16, textAlign: 'center', color: colores.texto2 }}>
                  En celulares Xiaomi/Redmi/Poco: poné CercaYa en "Sin restricciones" en el Ahorro de batería para evitar que el sistema duerma el servicio.
                </Texto>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </RequiereLogin>
  )
}

function PinMarcadorSimple({
  nombre,
  avatarUrl,
  esPropio,
}: {
  nombre: string
  avatarUrl?: string | null
  esPropio: boolean
}) {
  const colorBorde = esPropio ? colores.naranja : '#2563EB'
  const inicial = iniciales(nombre)

  return (
    <View style={estilosPin.contenedor}>
      <View style={[estilosPin.burbuja, { borderColor: colorBorde }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={estilosPin.avatar} resizeMode="cover" />
        ) : (
          <Text style={[estilosPin.inicial, { color: esPropio ? colores.tinta : '#1E40AF' }]}>
            {inicial}
          </Text>
        )}
      </View>
      <View style={[estilosPin.pico, { borderTopColor: colorBorde }]} />
    </View>
  )
}

const estilos = StyleSheet.create({
  contenido: {
    padding: espacio.l,
    gap: espacio.m,
    paddingBottom: espacio.xxl,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.fondo,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  botonChatRapido: {
    width: 44,
    height: 44,
    borderRadius: radio.full,
    backgroundColor: colores.grupo,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radio.m,
    padding: espacio.m,
  },
  cajaConectando: {
    padding: espacio.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cajaFinal: {
    backgroundColor: colores.grupo,
    padding: espacio.xl,
    borderRadius: radio.l,
    alignItems: 'center',
    gap: espacio.s,
    marginTop: espacio.m,
  },
  tarjetaAccionPendiente: {
    backgroundColor: colores.fondo,
    padding: espacio.l,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    gap: espacio.m,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: espacio.s,
  },
  botonMitad: {
    flex: 1,
    minHeight: 46,
  },
  llegaron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: radio.l,
    padding: espacio.m,
  },
  iconoCheckLlegaron: {
    width: 40,
    height: 40,
    borderRadius: radio.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenedorMapa: {
    height: 240,
    borderRadius: radio.l,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  mapa: {
    flex: 1,
  },
  botonReenfocar: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: radio.full,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tarjetaBrujula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.l,
    backgroundColor: colores.fondo,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  circuloFlecha: {
    width: 72,
    height: 72,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  tarjetaEsperandoGPS: {
    padding: espacio.l,
    backgroundColor: colores.grupo,
    borderRadius: radio.l,
    alignItems: 'center',
  },
  filaAcciones: {
    flexDirection: 'row',
    gap: espacio.s,
  },
  cajaAvisos: {
    backgroundColor: colores.grupo,
    padding: espacio.m,
    borderRadius: radio.m,
    gap: 6,
    marginTop: espacio.xs,
  },
})

const estilosPin = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 48,
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
    shadowOpacity: 0.22,
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
    fontSize: 13,
  },
  pico: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
})
