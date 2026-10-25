import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { Boton, Texto, Titulo } from '../components/ui'
import { estoyDisponible, HORAS_BASE, miDisponibilidad, yaNoDisponible, type MiDisponibilidad } from '../lib/disponibilidad'
import { useSesion } from '../lib/sesion'
import { disponibleAhora, textoDisponibleHasta } from '../lib/trabajo'
import { colores, espacio } from '../theme'

// Se abre desde el aviso de la manana: "Estas disponible hoy para trabajitos?"
export default function Disponibilidad() {
  const { sesion } = useSesion()
  const yo = sesion?.user.id
  const [estado, setEstado] = useState<MiDisponibilidad | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (yo) miDisponibilidad(yo).then(setEstado)
  }, [yo])

  async function responder(disponible: boolean) {
    setGuardando(true)
    try {
      if (disponible) await estoyDisponible(HORAS_BASE)
      else await yaNoDisponible()
      router.back()
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e.message)
      setGuardando(false)
    }
  }

  if (!estado) return <ActivityIndicator color={colores.naranjaOscuro} style={{ flex: 1 }} />

  if (!estado.ofrece) {
    return (
      <View style={estilos.pantalla}>
        <Titulo nivel={2}>Todavía no ofrecés servicios</Titulo>
        <Texto suave>Activá "Ofrezco servicios" en tu perfil para poder avisar que estás disponible.</Texto>
        <Boton onPress={() => router.replace('/editar-curriculum')}>Ir a Qué sabés hacer</Boton>
      </View>
    )
  }

  const disponible = disponibleAhora(estado.hasta)
  return (
    <View style={estilos.pantalla}>
      <Titulo nivel={2}>Estás disponible hoy para trabajitos?</Titulo>
      <Texto suave>
        {disponible && estado.hasta
          ? `Ahora figurás como disponible ${textoDisponibleHasta(estado.hasta)}.`
          : `Si decís que sí, aparecés primero en las búsquedas durante ${HORAS_BASE} horas. Después se apaga solo.`}
      </Texto>
      <Boton cargando={guardando} onPress={() => responder(true)}>
        {disponible ? `Seguir disponible ${HORAS_BASE} horas más` : `Sí, estoy disponible`}
      </Boton>
      <Boton variante="secundario" deshabilitado={guardando} onPress={() => responder(false)}>
        {disponible ? 'Ya no estoy disponible' : 'Hoy no'}
      </Boton>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, padding: espacio.xl, gap: espacio.l, justifyContent: 'center', backgroundColor: colores.fondo },
})
