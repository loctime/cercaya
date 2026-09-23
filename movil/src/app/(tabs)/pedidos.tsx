import { ClipboardList } from 'lucide-react-native'
import { View } from 'react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Vacio } from '../../components/ui'

// Etapa 3: mis pedidos (cliente) y mis trabajos (prestador).
export default function Pedidos() {
  return (
    <RequiereLogin
      icono={ClipboardList}
      titulo="Tus pedidos en un solo lugar"
      texto="Entrá para publicar pedidos y seguir cada trabajo, desde el primer mensaje hasta la calificación."
    >
      <View style={{ flex: 1 }}>
        <Vacio
          icono={ClipboardList}
          titulo="Todavía no publicaste ningún pedido"
          texto="Tocá el botón naranja de abajo para contar qué necesitás."
        />
      </View>
    </RequiereLogin>
  )
}
