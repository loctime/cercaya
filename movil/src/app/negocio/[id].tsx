import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { AtSign, Store } from 'lucide-react-native'
import { useCallback, useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Boton, Campo, Texto, Titulo } from '../../components/ui'
import {
  diasRestantes, miReclamo, pedirBajaNegocio, reclamarNegocio, textoMensajeCodigo,
  urlInstagram, urlInstagramOficial, urlWhatsApp, INSTAGRAM_OFICIAL,
} from '../../lib/negocios'
import { useSesion } from '../../lib/sesion'
import { colores, espacio, radio } from '../../theme'

type Params = {
  id: string; nombre: string; rubro: string; bio: string; instagram_usuario: string
  estado: string; es_mio: string; telefono: string; tipo: string
}

// Ficha de un negocio: datos, reclamo ("Es mío") y pedido de baja ("Esto no es mío").
export default function Negocio() {
  const p = useLocalSearchParams<Params>()
  const { sesion } = useSesion()
  const sinReclamar = p.estado === 'sin_reclamar'
  const [paso, setPaso] = useState<'ficha' | 'mail' | 'codigo'>('ficha')
  const [mail, setMail] = useState(sesion?.user.email ?? '')
  const [codigo, setCodigo] = useState<{ codigo: string; vence_at: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  // Si ya pidió el reclamo antes, mostrar el código directamente.
  useFocusEffect(
    useCallback(() => {
      if (!sesion || !sinReclamar) return
      miReclamo(p.id)
        .then((r) => {
          if (r) {
            setCodigo(r)
            setPaso('codigo')
          }
        })
        .catch(() => {})
    }, [sesion, sinReclamar, p.id]),
  )

  async function pedirReclamo() {
    setTrabajando(true)
    try {
      await reclamarNegocio(p.id, mail.trim())
      const r = await miReclamo(p.id)
      setCodigo(r)
      setPaso('codigo')
    } catch (e) {
      Alert.alert('No se pudo', (e as Error).message)
    } finally {
      setTrabajando(false)
    }
  }

  function pedirBaja() {
    Alert.alert('Sacar este negocio', 'Lo sacamos del mapa ahora mismo. Después lo revisamos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sacarlo',
        style: 'destructive',
        onPress: async () => {
          try {
            await pedirBajaNegocio(p.id)
            Alert.alert('Listo', 'Lo sacamos del mapa.')
            router.back()
          } catch (e) {
            Alert.alert('No se pudo', (e as Error).message)
          }
        },
      },
    ])
  }

  const whatsapp = urlWhatsApp(p.telefono)

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.cabecera}>
        <View style={estilos.icono}>
          <Store size={28} color={colores.tinta} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Titulo nivel={2}>{p.nombre}</Titulo>
          <Texto>{p.rubro}</Texto>
          {sinReclamar && (
            <Texto suave style={{ fontSize: 14 }}>
              Perfil sin reclamar
            </Texto>
          )}
        </View>
      </View>

      {!!p.bio && <Texto>{p.bio}</Texto>}

      <View style={estilos.acciones}>
        {whatsapp && (
          <Boton variante="whatsapp" onPress={() => Linking.openURL(whatsapp)} style={{ flex: 1 }}>
            WhatsApp
          </Boton>
        )}
        <Boton
          variante="secundario"
          icono={AtSign}
          onPress={() => Linking.openURL(urlInstagram(p.instagram_usuario))}
          style={{ flex: 1 }}
        >
          Instagram
        </Boton>
      </View>

      {p.es_mio === '1' && <Boton onPress={() => router.push('/mis-negocios')}>Editar mi negocio</Boton>}

      {sinReclamar && (
        <RequiereLogin
          icono={Store}
          titulo="Entrá para reclamar este negocio"
          texto="Necesitás una cuenta de CercaYa para reclamarlo o pedir que lo saquemos del mapa."
        >
          {paso === 'ficha' && (
            <View style={{ gap: espacio.s }}>
              <Boton onPress={() => setPaso('mail')}>Es mío</Boton>
              <Boton variante="secundario" onPress={pedirBaja}>
                Esto no es mío / sacalo
              </Boton>
            </View>
          )}

          {paso === 'mail' && (
            <View style={estilos.caja}>
              <Titulo nivel={3}>Reclamar este negocio</Titulo>
              <Texto suave style={{ fontSize: 14 }}>
                Dejanos un mail de contacto. Después te damos un código para que lo mandes por mensaje a @{INSTAGRAM_OFICIAL}.
              </Texto>
              <Campo
                etiqueta="Tu mail"
                value={mail}
                onChangeText={setMail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Boton cargando={trabajando} deshabilitado={!mail.includes('@')} onPress={pedirReclamo}>
                Pedir mi código
              </Boton>
              <Boton variante="secundario" onPress={() => setPaso('ficha')}>
                Volver
              </Boton>
            </View>
          )}

          {paso === 'codigo' && codigo && (
            <View style={estilos.caja}>
              <Titulo nivel={3}>Tu código</Titulo>
              <Texto style={estilos.codigo} accessibilityLabel={`Código ${codigo.codigo.split('').join(' ')}`}>
                {codigo.codigo}
              </Texto>
              <Texto>
                Mandanos este código por mensaje directo a @{INSTAGRAM_OFICIAL} desde la cuenta de Instagram del negocio (@
                {p.instagram_usuario}). Vence en {diasRestantes(codigo.vence_at)} días.
              </Texto>
              <Texto suave style={{ fontSize: 14 }}>
                {textoMensajeCodigo(codigo.codigo)}
              </Texto>
              <Boton icono={AtSign} onPress={() => Linking.openURL(urlInstagramOficial())}>
                Abrir @{INSTAGRAM_OFICIAL}
              </Boton>
              <Texto suave style={{ fontSize: 14 }}>
                Cuando lo revisemos, te avisamos y el negocio queda a tu nombre.
              </Texto>
            </View>
          )}
        </RequiereLogin>
      )}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, gap: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  icono: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acciones: { flexDirection: 'row', gap: espacio.s },
  caja: {
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.fondo,
  },
  codigo: { fontSize: 36, letterSpacing: 6, textAlign: 'center', paddingVertical: espacio.s },
})
