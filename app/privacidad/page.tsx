import type { Metadata } from 'next'
import Link from 'next/link'
import { ACTUALIZADO, EMAIL_CONTACTO } from '@/lib/sitio'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos guarda CercaYa, para qué los usa y cómo podés borrarlos.',
}

export default function Privacidad() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-12 legal">
      <h1 className="font-titulo font-extrabold text-3xl mb-2">Política de privacidad</h1>
      <p className="text-sm text-texto2">Última actualización: {ACTUALIZADO}</p>

      <p>
        CercaYa es una app para encontrar y contactar prestadores de servicios en Ramallo y zona. Esta política explica qué
        datos guardamos, para qué, con quién los compartimos y cómo podés pedir que los borremos. Cumplimos con la Ley
        25.326 de Protección de Datos Personales de la República Argentina.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Datos de tu cuenta:</strong> nombre, email, contraseña (guardada cifrada) y, si la cargás, tu foto y tu
          celular.
        </li>
        <li>
          <strong>Ubicación:</strong> la posición de tu celular (si das permiso) o la localidad que elijas. La usamos para
          calcular distancias. <strong>Nunca la mostramos a otras personas</strong>: los demás solo ven tu localidad y una
          distancia aproximada.
        </li>
        <li>
          <strong>Lo que publicás:</strong> pedidos (con sus fotos), servicios que ofrecés, fotos de tus trabajos, reseñas y
          mensajes del chat.
        </li>
        <li>
          <strong>Llegada al trabajo:</strong> si sos prestador y usás el botón "Llegué", guardamos tu posición en ese
          momento para confirmar que el trabajo se hizo. La otra persona solo ve el horario, no tu posición.
        </li>
        <li>
          <strong>Actividad para seguridad y métricas:</strong> registramos cuándo alguien ve un perfil, abre WhatsApp o
          pide un número, para mostrarle al prestador sus contactos recibidos y para prevenir abusos.
        </li>
        <li>
          <strong>Notificaciones:</strong> un identificador del celular para poder mandarte avisos, si los activás.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrarte prestadores y pedidos cerca tuyo.</li>
        <li>Permitir el chat, los pedidos, las calificaciones y las notificaciones.</li>
        <li>Prevenir estafas y abusos, y revisar denuncias.</li>
        <li>Mejorar la app. No vendemos tus datos ni los usamos para publicidad.</li>
      </ul>

      <h2>Quién ve qué</h2>
      <ul>
        <li>Tu nombre, tu foto, tu localidad y tus reseñas son públicos dentro de la app.</li>
        <li>
          Tu celular está <strong>oculto por defecto</strong>. Solo lo ven usuarios registrados y cercanos si vos activás
          "Mostrar mi número", o la persona a la que se lo compartas en un chat.
        </li>
        <li>Tus mensajes solo los ven vos y la otra persona del chat.</li>
      </ul>

      <h2>Con quién compartimos datos</h2>
      <p>Usamos proveedores que procesan datos por cuenta nuestra, solo para que la app funcione:</p>
      <ul>
        <li>Supabase: base de datos, cuentas y archivos.</li>
        <li>Expo y Google Firebase Cloud Messaging: envío de notificaciones al celular.</li>
        <li>Vercel: aloja este sitio web.</li>
      </ul>
      <p>
        Si elegís contactar a alguien por WhatsApp, esa conversación pasa a regirse por las políticas de WhatsApp. Podemos
        entregar datos a autoridades cuando la ley lo exija.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas la cuenta. Si la borrás, se eliminan tu perfil, tus datos privados, tus pedidos, tus chats, tus
        servicios y tus fotos. Tus reseñas quedan publicadas como "Usuario eliminado", sin ningún dato tuyo, para que las
        calificaciones sigan siendo confiables.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés acceder, corregir o borrar tus datos. La mayoría lo hacés desde la app (Perfil, Mis datos y Privacidad). Para
        borrar tu cuenta mirá <Link href="/borrar-cuenta">cómo borrar tu cuenta</Link>. Para cualquier otro pedido escribinos
        a <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a> y te respondemos dentro de los 10 días hábiles.
      </p>
      <p>
        La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la
        atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre
        protección de datos personales.
      </p>

      <h2>Edad mínima</h2>
      <p>Para usar CercaYa tenés que ser mayor de 18 años.</p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos esta política te lo vamos a avisar en la app. La fecha de arriba indica la última actualización.
      </p>

      <h2>Contacto</h2>
      <p>
        <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>
      </p>
    </main>
  )
}
