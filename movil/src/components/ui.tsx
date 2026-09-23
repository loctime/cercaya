// Piezas basicas de interfaz. Todo texto pasa por Titulo / Texto para
// respetar Nunito (titulos) e Inter (lectura).
import * as Haptics from 'expo-haptics'
import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native'
import { colores, espacio, fuentes, radio } from '../theme'

export function Titulo({ style, nivel = 1, ...props }: TextProps & { nivel?: 1 | 2 | 3 }) {
  return <Text {...props} style={[estilos.titulo, estilos[`t${nivel}`], style]} />
}

export function Texto({ style, suave, fuerte, ...props }: TextProps & { suave?: boolean; fuerte?: boolean }) {
  return (
    <Text
      {...props}
      style={[estilos.texto, suave && { color: colores.texto2 }, fuerte && { fontFamily: fuentes.textoFuerte }, style]}
    />
  )
}

type Variante = 'primario' | 'marca' | 'secundario' | 'whatsapp' | 'peligro'

const variantes: Record<Variante, { fondo: string; texto: string; borde?: string }> = {
  // Naranja oscuro con texto blanco: pasa contraste AA.
  primario: { fondo: colores.naranjaOscuro, texto: colores.blanco },
  // Naranja de marca siempre con texto oscuro.
  marca: { fondo: colores.naranja, texto: colores.tinta },
  secundario: { fondo: colores.fondo, texto: colores.tinta, borde: colores.borde },
  whatsapp: { fondo: colores.whatsapp, texto: colores.tinta },
  peligro: { fondo: colores.fondo, texto: colores.peligro, borde: colores.peligro },
}

export function Boton({
  children,
  onPress,
  variante = 'primario',
  icono: Icono,
  cargando,
  deshabilitado,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  variante?: Variante
  icono?: LucideIcon
  cargando?: boolean
  deshabilitado?: boolean
  style?: ViewStyle
}) {
  const v = variantes[variante]
  const inactivo = deshabilitado || cargando
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactivo}
      onPress={() => {
        Haptics.selectionAsync()
        onPress?.()
      }}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: v.fondo, borderColor: v.borde ?? v.fondo, opacity: inactivo ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={v.texto} />
      ) : (
        <>
          {Icono && <Icono size={20} color={v.texto} />}
          <Text style={[estilos.botonTexto, { color: v.texto }]}>{children}</Text>
        </>
      )}
    </Pressable>
  )
}

export function Campo({ etiqueta, error, ...props }: TextInputProps & { etiqueta: string; error?: string }) {
  return (
    <View style={{ gap: espacio.xs }}>
      <Texto fuerte style={{ fontSize: 14 }}>{etiqueta}</Texto>
      <TextInput
        placeholderTextColor={colores.texto2}
        {...props}
        style={[estilos.campo, error && { borderColor: colores.peligro }, props.style]}
      />
      {error ? <Texto style={{ color: colores.peligro, fontSize: 13 }}>{error}</Texto> : null}
    </View>
  )
}

export function Vacio({
  icono: Icono,
  titulo,
  texto,
  children,
}: {
  icono: LucideIcon
  titulo: string
  texto: string
  children?: ReactNode
}) {
  return (
    <View style={estilos.vacio}>
      <View style={estilos.vacioIcono}>
        <Icono size={32} color={colores.naranjaOscuro} />
      </View>
      <Titulo nivel={2} style={{ textAlign: 'center' }}>{titulo}</Titulo>
      <Texto suave style={{ textAlign: 'center' }}>{texto}</Texto>
      {children ? <View style={{ alignSelf: 'stretch', gap: espacio.s, marginTop: espacio.s }}>{children}</View> : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  titulo: { fontFamily: fuentes.titulo, color: colores.tinta },
  t1: { fontSize: 26, lineHeight: 32 },
  t2: { fontSize: 20, lineHeight: 26 },
  t3: { fontSize: 16, lineHeight: 22 },
  texto: { fontFamily: fuentes.texto, fontSize: 15, lineHeight: 22, color: colores.tinta },
  boton: {
    minHeight: 52,
    borderRadius: radio.m,
    borderWidth: 1.5,
    paddingHorizontal: espacio.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
  },
  botonTexto: { fontFamily: fuentes.tituloSuave, fontSize: 16 },
  campo: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colores.borde,
    borderRadius: radio.m,
    paddingHorizontal: espacio.m,
    fontFamily: fuentes.texto,
    fontSize: 16,
    color: colores.tinta,
    backgroundColor: colores.fondo,
  },
  vacio: { alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.xl, paddingVertical: espacio.xxl },
  vacioIcono: {
    width: 72,
    height: 72,
    borderRadius: radio.full,
    backgroundColor: colores.naranjaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.s,
  },
})
