import { router } from 'expo-router'
import { MessageCircle } from 'lucide-react-native'
import { Boton, Vacio } from '../../components/ui'

// Etapa 4: conversacion. La conversacion ya queda creada en la base
// (abrir_chat); aca falta la pantalla de mensajes.
export default function Chat() {
  return (
    <Vacio
      icono={MessageCircle}
      titulo="Chat abierto"
      texto="La conversación ya quedó creada. La pantalla de mensajes llega en la etapa 4."
    >
      <Boton variante="secundario" onPress={() => router.back()}>
        Volver
      </Boton>
    </Vacio>
  )
}
