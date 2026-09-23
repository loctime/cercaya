import type { Metadata } from 'next'
import { EMAIL_CONTACTO } from '@/lib/sitio'

export const metadata: Metadata = {
  title: 'Borrar mi cuenta',
  description: 'Cómo borrar tu cuenta de CercaYa y qué datos se eliminan.',
}

export default function BorrarCuenta() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-12 legal">
      <h1 className="font-titulo font-extrabold text-3xl mb-4">Borrar mi cuenta de CercaYa</h1>

      <h2>Desde la app (inmediato)</h2>
      <ul>
        <li>Abrí CercaYa e iniciá sesión.</li>
        <li>
          Andá a <strong>Perfil</strong> y tocá <strong>Eliminar mi cuenta</strong>, al final de la pantalla.
        </li>
        <li>Confirmá. La cuenta se borra en el momento.</li>
      </ul>

      <h2>Si no tenés la app</h2>
      <p>
        Escribinos a <a href={`mailto:${EMAIL_CONTACTO}?subject=Borrar%20mi%20cuenta`}>{EMAIL_CONTACTO}</a> desde el email con
        el que te registraste, con el asunto "Borrar mi cuenta". La borramos dentro de los 10 días hábiles y te avisamos
        cuando esté hecho.
      </p>

      <h2>Qué se borra</h2>
      <ul>
        <li>Tu perfil, tu foto, tu celular y tu ubicación.</li>
        <li>Tus pedidos y sus fotos.</li>
        <li>Tus servicios, tu galería de trabajos y tus métricas.</li>
        <li>Tus chats.</li>
        <li>Los identificadores de notificaciones de tus celulares.</li>
      </ul>

      <h2>Qué queda</h2>
      <p>
        Las reseñas que escribiste quedan publicadas como <strong>"Usuario eliminado"</strong>, sin tu nombre ni ningún dato
        tuyo, para que las calificaciones de los prestadores sigan siendo confiables. Si querés que también se borren,
        pedilo por email y lo hacemos.
      </p>
    </main>
  )
}
