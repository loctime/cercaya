import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { BadgeCheck, Star } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Boton, Campo, Texto, Titulo } from '../components/ui'
import { supabase } from '../lib/supabase'
import { colores, espacio, radio } from '../theme'

const AMARILLO = '#F59E0B'
const ETIQUETAS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente']

// Calificacion mutua: el cliente califica al prestador y viceversa.
export default function Calificar() {
  const { job, nombre, rol, verificado } = useLocalSearchParams<{
    job: string
    nombre: string
    rol: 'prestador' | 'cliente'
    verificado?: string
  }>()
  const [estrellas, setEstrellas] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const primerNombre = (nombre ?? '').split(' ')[0]

  async function enviar() {
    setEnviando(true)
    setError('')
    const { error: e } = await supabase.rpc('calificar', {
      p_job: job,
      p_rating: estrellas,
      p_comment: comentario.trim() || null,
    })
    setEnviando(false)
    if (e) return setError(e.message)
    router.back()
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Titulo>Cómo te fue con {primerNombre}?</Titulo>
      <Texto suave>
        {rol === 'prestador'
          ? 'Tu reseña ayuda a otros vecinos a elegir. Contá qué tal la puntualidad, la prolijidad y el trato.'
          : 'Tu calificación ayuda a otros prestadores. Contá qué tal la claridad del pedido, el trato y el pago.'}
      </Texto>

      <View style={estilos.estrellas} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: estrellas }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}
            hitSlop={6}
            onPress={() => {
              Haptics.selectionAsync()
              setEstrellas(i)
            }}
          >
            <Star size={44} color={i <= estrellas ? AMARILLO : colores.borde} fill={i <= estrellas ? AMARILLO : 'transparent'} />
          </Pressable>
        ))}
      </View>
      <Texto fuerte style={{ textAlign: 'center', minHeight: 22 }}>{ETIQUETAS[estrellas]}</Texto>

      <Campo
        etiqueta="Comentario (opcional)"
        value={comentario}
        onChangeText={setComentario}
        multiline
        maxLength={1000}
        style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: espacio.m }}
      />

      {rol === 'prestador' && verificado ? (
        <View style={estilos.verificado}>
          <BadgeCheck size={18} color={colores.exito} />
          <Texto style={{ flex: 1, fontSize: 14 }}>Esta reseña va a llevar la marca "Trabajo verificado".</Texto>
        </View>
      ) : null}

      {error ? <Texto style={{ color: colores.peligro }}>{error}</Texto> : null}
      <Boton onPress={enviar} cargando={enviando} deshabilitado={estrellas === 0}>
        Enviar calificación
      </Boton>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  estrellas: { flexDirection: 'row', justifyContent: 'center', gap: espacio.s, marginTop: espacio.s },
  verificado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.m,
    backgroundColor: '#ECFDF5',
  },
})
