import { router } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { Camera } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Avatar } from '../components/Avatar'
import { Boton, Campo, Texto } from '../components/ui'
import { elegirImagenes, subirImagen, urlPublica, type FotoLocal } from '../lib/imagenes'
import { useSesion } from '../lib/sesion'
import { supabase } from '../lib/supabase'
import { numeroWhatsApp } from '../lib/telefono'
import { colores, espacio, radio } from '../theme'

export default function EditarPerfil() {
  const alturaHeader = useHeaderHeight()
  const { sesion, perfil, recargarPerfil } = useSesion()
  const yo = sesion?.user.id ?? ''
  const [nombre, setNombre] = useState(perfil?.full_name ?? '')
  const [celular, setCelular] = useState('')
  const [fotoNueva, setFotoNueva] = useState<FotoLocal | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('profile_private')
      .select('phone')
      .eq('user_id', yo)
      .single()
      .then(({ data }) => setCelular(data?.phone ?? ''))
  }, [yo])

  async function cambiarFoto() {
    const [f] = await elegirImagenes(1, { cuadrada: true })
    if (f) setFotoNueva(f)
  }

  async function guardar() {
    setError('')
    if (nombre.trim().length < 2) return setError('Escribí tu nombre.')
    if (celular.trim() && !numeroWhatsApp(celular)) {
      return setError('Revisá el celular: con característica, por ejemplo 3407 123456.')
    }
    setGuardando(true)
    try {
      let avatar_url = perfil?.avatar_url ?? null
      if (fotoNueva) {
        const anterior = avatar_url?.split('/object/public/avatares/')[1]
        avatar_url = urlPublica('avatares', await subirImagen('avatares', yo, fotoNueva))
        // La foto vieja no queda huerfana en el storage.
        if (anterior) supabase.storage.from('avatares').remove([decodeURIComponent(anterior)])
      }
      const r1 = await supabase.from('profiles').update({ full_name: nombre.trim(), avatar_url }).eq('id', yo)
      if (r1.error) throw r1.error
      const r2 = await supabase.from('profile_private').update({ phone: celular.trim() || null }).eq('user_id', yo)
      if (r2.error) throw r2.error
      await recargarPerfil()
      router.back()
    } catch {
      setError('No pudimos guardar los cambios. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? alturaHeader : 0}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto" onPress={cambiarFoto} style={estilos.foto}>
          <Avatar nombre={nombre || 'Yo'} url={fotoNueva?.uri ?? perfil?.avatar_url} tam={112} />
          <View style={estilos.camara}>
            <Camera size={18} color={colores.tinta} />
          </View>
        </Pressable>

        <Campo etiqueta="Nombre y apellido" value={nombre} onChangeText={setNombre} maxLength={80} autoComplete="name" />
        <View style={{ gap: espacio.xs }}>
          <Campo
            etiqueta="Celular"
            placeholder="3407 123456"
            value={celular}
            onChangeText={setCelular}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <Texto suave style={{ fontSize: 14 }}>
            No se muestra a nadie salvo que lo actives en Privacidad o lo compartas en un chat.
          </Texto>
        </View>

        {error ? <Texto style={{ color: colores.peligro }}>{error}</Texto> : null}
        <Boton onPress={guardar} cargando={guardando}>
          Guardar cambios
        </Boton>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  foto: { alignSelf: 'center', marginBottom: espacio.s },
  camara: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: radio.full,
    backgroundColor: colores.naranja,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colores.fondo,
  },
})
