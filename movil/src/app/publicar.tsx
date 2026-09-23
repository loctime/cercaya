import { router } from 'expo-router'
import { ClipboardPen } from 'lucide-react-native'
import { Boton, Vacio } from '../components/ui'

// Etapa 3: formulario de publicar pedido (categoria, descripcion, fotos,
// localidad, urgencia) contra la funcion publicar_pedido.
export default function Publicar() {
  return (
    <Vacio
      icono={ClipboardPen}
      titulo="Publicar un pedido"
      texto="El formulario para contar qué necesitás llega en la próxima etapa."
    >
      <Boton variante="secundario" onPress={() => router.back()}>
        Volver
      </Boton>
    </Vacio>
  )
}
