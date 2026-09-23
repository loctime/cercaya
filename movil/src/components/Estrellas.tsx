import { Star } from 'lucide-react-native'
import { View } from 'react-native'
import { colores, espacio } from '../theme'
import { Texto } from './ui'

const AMARILLO = '#F59E0B'

// "★ 4,8 (12 reseñas)" o "Sin reseñas todavía".
export function Calificacion({ promedio, cantidad }: { promedio: number | string | null; cantidad: number | string }) {
  const n = Number(cantidad)
  if (!n || promedio == null) {
    return <Texto suave style={{ fontSize: 13 }}>Sin reseñas todavía</Texto>
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
      <Star size={15} color={AMARILLO} fill={AMARILLO} />
      <Texto fuerte style={{ fontSize: 14 }}>{Number(promedio).toLocaleString('es-AR')}</Texto>
      <Texto suave style={{ fontSize: 13 }}>
        ({n} {n === 1 ? 'reseña' : 'reseñas'})
      </Texto>
    </View>
  )
}

// Fila de estrellas fija (para cada reseña).
export function Estrellas({ valor, tam = 14 }: { valor: number; tam?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={tam} color={i <= valor ? AMARILLO : colores.borde} fill={i <= valor ? AMARILLO : 'transparent'} />
      ))}
    </View>
  )
}
