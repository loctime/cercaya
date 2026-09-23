import { Image, StyleSheet, Text, View } from 'react-native'
import { colores, fuentes } from '../theme'

export function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function Avatar({ nombre, url, tam = 48 }: { nombre: string; url?: string | null; tam?: number }) {
  const forma = { width: tam, height: tam, borderRadius: tam / 2 }
  if (url) {
    return <Image source={{ uri: url }} style={forma} resizeMode="cover" accessibilityLabel={`Foto de ${nombre}`} />
  }
  return (
    <View style={[forma, estilos.fondo]} accessibilityLabel={nombre}>
      <Text style={[estilos.texto, { fontSize: tam * 0.36 }]}>{iniciales(nombre)}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  fondo: { backgroundColor: colores.naranja, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fuentes.titulo, color: colores.tinta },
})
