import { router } from 'expo-router'
import { MessageCircle } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { Categoria } from '../lib/datos'
import { textoDistancia } from '../lib/datos'
import { contactar } from '../lib/contacto'
import { colores, espacio, fuentes, radio } from '../theme'
import { Avatar } from './Avatar'
import { Calificacion } from './Estrellas'
import { IconoWhatsApp } from './IconoWhatsApp'
import { Texto } from './ui'

export type PrestadorLista = {
  user_id: string
  full_name: string
  avatar_url: string | null
  zone_label: string | null
  categorias: number[]
  price_range: string | null
  distancia_km: number | string
  calificacion: number | string | null
  cant_resenas: number | string
  trabajos_realizados: number | string
  contacto: 'whatsapp' | 'chat'
}

export function TarjetaPrestador({
  p,
  categorias,
  conSesion,
}: {
  p: PrestadorLista
  categorias: Categoria[]
  conSesion: boolean
}) {
  const [contactando, setContactando] = useState(false)
  const rubros = p.categorias.map((id) => categorias.find((c) => c.id === id)).filter(Boolean) as Categoria[]
  const esWhatsApp = p.contacto === 'whatsapp'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${p.full_name}`}
      onPress={() => router.push({ pathname: '/prestador/[id]', params: { id: p.user_id } })}
      style={({ pressed }) => [estilos.tarjeta, pressed && { backgroundColor: colores.grupo }]}
    >
      <Avatar nombre={p.full_name} url={p.avatar_url} tam={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <Texto style={estilos.nombre} numberOfLines={1}>
          {p.full_name}
        </Texto>
        <View style={estilos.pills}>
          {rubros.slice(0, 3).map((c) => (
            <View key={c.id} style={estilos.pill}>
              <Texto style={estilos.pillTexto}>{c.name}</Texto>
            </View>
          ))}
        </View>
        <Texto suave style={{ fontSize: 13 }}>
          {[p.zone_label, textoDistancia(p.distancia_km)].filter(Boolean).join(', ')}
        </Texto>
        <Calificacion promedio={p.calificacion} cantidad={p.cant_resenas} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={esWhatsApp ? `Contactar a ${p.full_name} por WhatsApp` : `Enviar mensaje a ${p.full_name}`}
        hitSlop={8}
        disabled={contactando}
        onPress={async () => {
          setContactando(true)
          await contactar({ userId: p.user_id, nombre: p.full_name, rubro: rubros[0]?.name, conSesion })
          setContactando(false)
        }}
        style={[estilos.contacto, { backgroundColor: esWhatsApp ? colores.whatsapp : colores.naranjaSuave }]}
      >
        {contactando ? (
          <ActivityIndicator color={colores.tinta} />
        ) : esWhatsApp ? (
          <IconoWhatsApp size={22} color={colores.tinta} />
        ) : (
          <MessageCircle size={22} color={colores.naranjaOscuro} />
        )}
      </Pressable>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    marginHorizontal: espacio.l,
    padding: espacio.m,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.fondo,
  },
  nombre: { fontFamily: fuentes.tituloSuave, fontSize: 17 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radio.full, backgroundColor: colores.grupo },
  pillTexto: { fontSize: 12, lineHeight: 16, fontFamily: fuentes.textoMedio },
  contacto: { width: 48, height: 48, borderRadius: radio.full, alignItems: 'center', justifyContent: 'center' },
})
