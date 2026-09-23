import { router } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { MailCheck } from 'lucide-react-native'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Boton, Campo, Texto, Titulo, Vacio } from '../components/ui'
import { abrirPagina } from '../lib/sitio'
import { supabase } from '../lib/supabase'
import { colores, espacio, fuentes, radio } from '../theme'

type Modo = 'entrar' | 'registro'

// Login / registro diferido: se abre como modal cuando un invitado
// intenta hacer algo que necesita cuenta.
export default function Login() {
  const alturaHeader = useHeaderHeight()
  const [modo, setModo] = useState<Modo>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [celular, setCelular] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [revisarMail, setRevisarMail] = useState(false)

  async function enviar() {
    setError('')
    if (!email.includes('@')) return setError('Revisá el email.')
    if (clave.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.')
    if (modo === 'registro' && nombre.trim().length < 2) return setError('Contanos tu nombre.')

    setCargando(true)
    if (modo === 'entrar') {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
      setCargando(false)
      if (e) {
        return setError(
          e.message.includes('not confirmed')
            ? 'Todavía no confirmaste tu email. Revisá tu casilla.'
            : 'Email o contraseña incorrectos.',
        )
      }
      router.back()
      return
    }

    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password: clave,
      // Los lee el trigger que crea el perfil en la base.
      options: { data: { full_name: nombre.trim(), phone: celular.trim() || null } },
    })
    setCargando(false)
    if (e) {
      return setError(
        e.message.toLowerCase().includes('rate limit')
          ? 'Hay muchos registros en este momento. Probá de nuevo en un rato.'
          : 'No pudimos crear la cuenta. Revisá los datos.',
      )
    }
    if (data.session) router.back()
    else setRevisarMail(true)
  }

  if (revisarMail) {
    return (
      <Vacio
        icono={MailCheck}
        titulo="Revisá tu email"
        texto={`Te mandamos un link a ${email.trim()} para confirmar la cuenta. Después volvé y entrá con tu contraseña.`}
      >
        <Boton
          variante="secundario"
          onPress={() => {
            setRevisarMail(false)
            setModo('entrar')
          }}
        >
          Ya confirmé, entrar
        </Boton>
      </Vacio>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? alturaHeader : 0}
    >
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>{modo === 'entrar' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}</Titulo>
        <Texto suave>
          {modo === 'entrar'
            ? 'Entrá con tu email y contraseña.'
            : 'Te lleva menos de un minuto. Tu celular no se muestra a nadie salvo que vos lo decidas.'}
        </Texto>

        <View style={estilos.selector}>
          {(['entrar', 'registro'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: modo === m }}
              onPress={() => {
                setModo(m)
                setError('')
              }}
              style={[estilos.opcion, modo === m && estilos.opcionActiva]}
            >
              <Texto style={[estilos.opcionTexto, modo === m && { color: colores.tinta }]}>
                {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              </Texto>
            </Pressable>
          ))}
        </View>

        {modo === 'registro' && (
          <Campo etiqueta="Nombre y apellido" value={nombre} onChangeText={setNombre} autoComplete="name" />
        )}
        <Campo
          etiqueta="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Campo
          etiqueta="Contraseña"
          value={clave}
          onChangeText={setClave}
          secureTextEntry
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
        />
        {modo === 'registro' && (
          <Campo
            etiqueta="Celular (opcional)"
            placeholder="3407 123456"
            value={celular}
            onChangeText={setCelular}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        )}

        {error ? <Texto style={{ color: colores.peligro }}>{error}</Texto> : null}

        <Boton onPress={enviar} cargando={cargando}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </Boton>

        {modo === 'registro' && (
          <Texto suave style={{ fontSize: 14, textAlign: 'center' }}>
            Al crear la cuenta aceptás los{' '}
            <Texto style={estilos.link} onPress={() => abrirPagina('terminos')}>
              Términos
            </Texto>{' '}
            y la{' '}
            <Texto style={estilos.link} onPress={() => abrirPagina('privacidad')}>
              Política de Privacidad
            </Texto>{' '}
            de CercaYa.
          </Texto>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.xl, gap: espacio.l },
  selector: { flexDirection: 'row', backgroundColor: colores.grupo, borderRadius: radio.m, padding: 4 },
  opcion: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radio.s },
  opcionActiva: { backgroundColor: colores.fondo, borderWidth: 1, borderColor: colores.borde },
  opcionTexto: { fontFamily: fuentes.textoFuerte, color: colores.texto2 },
  link: { fontSize: 14, color: colores.naranjaOscuro, textDecorationLine: 'underline' },
})
