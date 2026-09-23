import type { Metadata } from 'next'
import Link from 'next/link'
import { EMAIL_CONTACTO } from '@/lib/sitio'

export const metadata: Metadata = {
  title: 'Ayuda y soporte',
  description: 'Respuestas a las dudas más comunes sobre CercaYa y cómo contactarnos.',
}

const PREGUNTAS: { p: string; r: React.ReactNode }[] = [
  {
    p: 'Cuánto cuesta?',
    r: 'Nada. CercaYa es gratis para vecinos y prestadores, y no cobra comisiones. El precio del trabajo lo acuerdan entre ustedes.',
  },
  {
    p: 'Cómo contacto a un prestador?',
    r: 'Desde su perfil. Si muestra su número, podés escribirle por WhatsApp; si no, por el chat de CercaYa. En el chat cualquiera de los dos puede compartir su contacto cuando quiera.',
  },
  {
    p: 'Quién ve mi número y mi dirección?',
    r: 'Tu dirección y tu ubicación exacta, nadie. Tu número está oculto por defecto: lo mostrás desde Perfil > Privacidad, o lo compartís en un chat puntual.',
  },
  {
    p: 'Cómo ofrezco mis servicios?',
    r: 'En Perfil tocá "Sumar mis servicios", elegí tus rubros y contá tu experiencia. Revisamos cada perfil antes de publicarlo; te avisamos cuando estés en el catálogo.',
  },
  {
    p: 'No me llegan las notificaciones',
    r: 'Fijate en Perfil > Notificaciones que diga "Tu celular está conectado a los avisos". Si usás VPN, apagala y tocá "Reintentar": algunas VPN bloquean las notificaciones. En Xiaomi, Redmi y POCO activá "Inicio automático" y poné el ahorro de batería de CercaYa en "Sin restricciones".',
  },
  {
    p: 'Cómo califico un trabajo?',
    r: 'Cuando el prestador marca "Trabajo realizado" y vos confirmás "Pago recibido / Trabajo conforme", se habilita la calificación para los dos.',
  },
  {
    p: 'Alguien me trató mal o intentó estafarme',
    r: 'Denuncialo desde el menú de su perfil, del pedido o del chat, y bloquealo si querés. Revisamos todas las denuncias.',
  },
  {
    p: 'Cómo borro mi cuenta?',
    r: (
      <>
        Desde Perfil &gt; Eliminar mi cuenta. Más detalles en <Link href="/borrar-cuenta">borrar mi cuenta</Link>.
      </>
    ),
  },
]

export default function Soporte() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-12 legal">
      <h1 className="font-titulo font-extrabold text-3xl mb-4">Ayuda y soporte</h1>
      <p>
        Si no encontrás tu respuesta acá, escribinos a <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>. Respondemos en
        el día hábil.
      </p>
      {PREGUNTAS.map((q) => (
        <section key={q.p}>
          <h2>{q.p}</h2>
          <p>{q.r}</p>
        </section>
      ))}
    </main>
  )
}
