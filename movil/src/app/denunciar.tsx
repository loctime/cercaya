import { router, useLocalSearchParams } from 'expo-router'
import { Check, ShieldCheck } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Boton, Campo, Texto, Titulo, Vacio } from '../components/ui'
import { denunciar, MOTIVOS_DENUNCIA, type MotivoDenuncia, type TipoDenuncia } from '../lib/moderacion'
import { colores, espacio, radio } from '../theme'

// Denuncia generica: se abre con ?tipo=perfil|resena|pedido|mensaje|chat&id=...
export default function Denunciar() {
  const { tipo, id } = useLocalSearchParams<{ tipo: TipoDenuncia; id: string }>()
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  async function enviar() {
    if (!motivo) return
    setEnviando(true)
    setError('')
    const { error: e } = await denunciar(tipo, id, motivo, detalle)
    setEnviando(false)
    if (e) {
      setError(e.message.includes('limite') ? 'Llegaste al límite de denuncias por hoy.' : 'No pudimos enviar la denuncia.')
      return
    }
    setListo(true)
  }

  if (listo) {
    return (
      <Vacio
        icono={ShieldCheck}
        titulo="Gracias por avisarnos"
        texto="Revisamos cada denuncia. Si hace falta, suspendemos la cuenta. Si te sentís en riesgo, también podés bloquear a este usuario."
      >
        <Boton variante="secundario" onPress={() => router.back()}>
          Volver
        </Boton>
      </Vacio>
    )
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Titulo nivel={2}>Qué está pasando?</Titulo>
      <Texto suave>Tu denuncia es anónima: la otra persona no se entera de quién la hizo.</Texto>
      <View style={estilos.lista}>
        {MOTIVOS_DENUNCIA.map((m, i) => (
          <Pressable
            key={m.valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: motivo === m.valor }}
            onPress={() => setMotivo(m.valor)}
            style={[estilos.fila, i > 0 && estilos.separador]}
          >
            <Texto style={{ flex: 1 }}>{m.texto}</Texto>
            {motivo === m.valor && <Check size={20} color={colores.naranjaOscuro} />}
          </Pressable>
        ))}
      </View>
      <Campo
        etiqueta="Contanos más (opcional)"
        value={detalle}
        onChangeText={setDetalle}
        multiline
        maxLength={1000}
        style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: espacio.m }}
      />
      {error ? <Texto style={{ color: colores.peligro }}>{error}</Texto> : null}
      <Boton onPress={enviar} cargando={enviando} deshabilitado={!motivo}>
        Enviar denuncia
      </Boton>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  lista: { borderRadius: radio.m, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: espacio.l, gap: espacio.m },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde },
})
