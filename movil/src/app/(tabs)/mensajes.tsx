import { MessageCircle } from 'lucide-react-native'
import { View } from 'react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Vacio } from '../../components/ui'

// Etapa 4: lista de chats.
export default function Mensajes() {
  return (
    <RequiereLogin
      icono={MessageCircle}
      titulo="Hablá sin dar tu número"
      texto="Entrá para chatear con vecinos y prestadores. Tu teléfono solo lo ve quien vos elijas."
    >
      <View style={{ flex: 1 }}>
        <Vacio
          icono={MessageCircle}
          titulo="No tenés conversaciones"
          texto="Cuando consultes a un prestador o alguien se interese en tu pedido, los chats aparecen acá."
        />
      </View>
    </RequiereLogin>
  )
}
