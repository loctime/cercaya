import * as Device from 'expo-device'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowUp, MapPinned } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { Avatar } from '../../components/Avatar'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Texto, Titulo } from '../../components/ui'
import {
  misEncuentros,
  responderEncuentro,
  terminarEncuentro,
  type EncuentroResumen,
  type EstadoEncuentro,
} from '../../lib/encuentros'
import { textoCardinal, textoDistancia } from '../../lib/geo'
import { textoHace } from '../../lib/tiempo'
import { useEncuentro } from '../../lib/useEncuentro'
import { colores, espacio, radio } from '../../theme'

const SIN_SENAL_MS = 2 * 60 * 1000

// Estas marcas cierran las apps en segundo plano si no se las excluye del ahorro de bateria.
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
  const [resumen, setResumen] = useState<EncuentroResumen | null>(null)
  const { estado, yo, otro, rumbo, giro, distanciaM, llegaron, error, refrescar } = useEncuentro(
    id,
    resumen?.otro_nombre,
    resumen?.soy_solicitante,
  )
  const mapa = useRef<MapView>(null)

  // Quien es el otro y si pedi yo; se vuelve a leer cuando cambia el estado.
  useEffect(() => {
    misEncuentros()
      .then((lista) => {
        const mio = lista.find((x) => x.id === id)
        if (mio) setResumen(mio)
      })
      .catch(() => {})
  }, [id, estado?.estado])

  useEffect(() => {
    if (!yo || !otro) return
    mapa.current?.fitToCoordinates(
      [
        { latitude: yo.lat, longitude: yo.lng },
        { latitude: otro.lat, longitude: otro.lng },
      ],
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
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

  const final = estado && MENSAJE_FINAL[estado.estado]
  const sinSenal = estado?.otro_at != null && Date.now() - new Date(estado.otro_at).getTime() > SIN_SENAL_MS

  return (
    <RequiereLogin
      icono={MapPinned}
      titulo="Voy para allá"
      texto="Entrá para compartir tu ubicación con tus contactos."
    >
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          <Avatar nombre={nombre} url={resumen?.otro_avatar} tam={56} />
          <View style={{ flex: 1 }}>
            <Titulo nivel={2}>{nombre}</Titulo>
            {resumen?.estado === 'activo' && resumen.ends_at && (
              <Texto suave>Hasta las {new Date(resumen.ends_at).toTimeString().slice(0, 5)}</Texto>
            )}
          </View>
        </View>

        {error !== '' && <Texto style={{ color: colores.peligro }}>{error}</Texto>}
        {estado === null && error === '' && <Texto suave>Conectando…</Texto>}

        {final && (
          <>
            <Texto>{final}</Texto>
            <Boton variante="secundario" onPress={() => router.back()}>
              Volver
            </Boton>
          </>
        )}

        {estado?.estado === 'pendiente' && resumen && !resumen.soy_solicitante && (
          <>
            <Texto>
              {primerNombre} va para allá. Si aceptás, se ven en el mapa en vivo y con ubicación exacta, solo ustedes
              dos.
            </Texto>
            <Boton onPress={() => accion(() => responderEncuentro(id, true))}>Aceptar</Boton>
            <Boton variante="secundario" onPress={() => accion(() => responderEncuentro(id, false), true)}>
              Rechazar
            </Boton>
          </>
        )}

        {estado?.estado === 'pendiente' && resumen?.soy_solicitante && (
          <>
            <Texto>Esperando que {primerNombre} acepte. Si no responde en 15 minutos, se cancela solo.</Texto>
            <Boton variante="secundario" onPress={() => accion(() => terminarEncuentro(id), true)}>
              Cancelar
            </Boton>
          </>
        )}

        {estado?.estado === 'activo' && (
          <>
            {llegaron && (
              <View style={estilos.llegaron}>
                <Titulo nivel={3}>¡Llegaron!</Titulo>
                <Texto>Ya están a menos de 50 metros.</Texto>
              </View>
            )}

            <MapView
              ref={mapa}
              style={estilos.mapa}
              initialRegion={{
                latitude: yo?.lat ?? otro?.lat ?? -33.4833,
                longitude: yo?.lng ?? otro?.lng ?? -60.0167,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              {yo && (
                <Marker coordinate={{ latitude: yo.lat, longitude: yo.lng }} title="Vos" pinColor={colores.naranja} />
              )}
              {otro && (
                <Marker
                  coordinate={{ latitude: otro.lat, longitude: otro.lng }}
                  title={nombre}
                  pinColor="#2563EB"
                  opacity={sinSenal ? 0.5 : 1}
                />
              )}
            </MapView>

            {otro && distanciaM != null ? (
              <View style={estilos.brujula}>
                <View style={[estilos.flecha, giro != null && { transform: [{ rotate: `${giro}deg` }] }]}>
                  <ArrowUp size={44} color={colores.tinta} strokeWidth={3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Titulo nivel={2}>{textoDistancia(distanciaM)}</Titulo>
                  <Texto suave>{rumbo != null ? `Hacia el ${textoCardinal(rumbo)}` : ''}</Texto>
                </View>
              </View>
            ) : (
              <Texto suave>Esperando la ubicación de {primerNombre}…</Texto>
            )}

            {estado.otro_at && (
              <Texto suave>
                {sinSenal
                  ? `Sin señal de ${primerNombre} desde ${textoHace(estado.otro_at)}. Mostramos su último punto.`
                  : `Actualizado ${textoHace(estado.otro_at)}`}
              </Texto>
            )}

            {otro && <Boton onPress={comoLlegar}>Cómo llegar</Boton>}
            <Boton variante="secundario" onPress={() => accion(() => terminarEncuentro(id))}>
              Terminar
            </Boton>
            <Texto suave>Podés guardar el celular: seguimos compartiendo hasta que termine.</Texto>
            {esAgresiva && (
              <Texto suave>
                En tu celular, para que no se corte con la pantalla apagada: Ajustes, Apps, CercaYa, Ahorro de batería,
                Sin restricciones.
              </Texto>
            )}
          </>
        )}
      </ScrollView>
    </RequiereLogin>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  mapa: { height: 260, borderRadius: radio.l, overflow: 'hidden' },
  brujula: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  flecha: {
    width: 80,
    height: 80,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  llegaron: { backgroundColor: colores.naranjaSuave, borderRadius: radio.l, padding: espacio.m, gap: espacio.xs },
})
