import type { Metadata } from 'next'
import Link from 'next/link'
import { ACTUALIZADO, EMAIL_CONTACTO, RESPONSABLE } from '@/lib/sitio'

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Reglas de uso de CercaYa.',
}

export default function Terminos() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-12 legal">
      <h1 className="font-titulo font-extrabold text-3xl mb-2">Términos y condiciones</h1>
      <p className="text-sm text-texto2">Última actualización: {ACTUALIZADO}</p>

      <p>
        CercaYa es un servicio de <strong>{RESPONSABLE}</strong> (Ramallo, provincia de Buenos Aires, Argentina). Al crear
        una cuenta o usar CercaYa aceptás estos términos. Si no estás de acuerdo, no uses la app.
      </p>

      <h2>Qué es CercaYa</h2>
      <p>
        CercaYa conecta a vecinos que necesitan un servicio con personas que lo ofrecen. <strong>CercaYa no presta los
        servicios ni forma parte de los acuerdos</strong> entre usuarios: el precio, la forma de pago, los plazos y la calidad
        del trabajo se acuerdan directamente entre las partes. CercaYa no cobra comisiones ni procesa pagos.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Tenés que ser mayor de 18 años y dar datos reales.</li>
        <li>Sos responsable de lo que se haga con tu cuenta. Cuidá tu contraseña.</li>
        <li>Podés borrar tu cuenta cuando quieras (ver <Link href="/borrar-cuenta">cómo borrarla</Link>).</li>
      </ul>

      <h2>Si ofrecés servicios</h2>
      <ul>
        <li>Revisamos cada perfil de prestador antes de publicarlo, y podemos rechazarlo o suspenderlo.</li>
        <li>
          Lo que publicás (experiencia, precios, fotos) tiene que ser verdadero y tuyo. Sos responsable de contar con las
          habilitaciones o matrículas que tu oficio requiera.
        </li>
        <li>Sos responsable del trabajo que hacés y de cumplir lo que acordás con cada cliente.</li>
      </ul>

      <h2>Reglas de convivencia</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Estafar, engañar o pedir pagos por fuera de lo acordado.</li>
        <li>Insultar, acosar, discriminar o amenazar a otros usuarios.</li>
        <li>Publicar contenido falso, ofensivo, sexual o ilegal, o spam.</li>
        <li>Dejar reseñas falsas o manipular calificaciones.</li>
        <li>Juntar datos de otros usuarios (por ejemplo, números de teléfono) para otros fines.</li>
      </ul>
      <p>
        Podés denunciar perfiles, pedidos, reseñas y chats desde la app, y bloquear a cualquier usuario. Revisamos las
        denuncias y podemos borrar contenido, suspender o eliminar cuentas que no cumplan estas reglas.
      </p>

      <h2>Reseñas</h2>
      <p>
        Solo se puede calificar un trabajo cuando las dos partes lo dan por terminado en la app. Las reseñas tienen que
        reflejar una experiencia real.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Hacemos lo posible para que CercaYa funcione bien y sea seguro, pero no garantizamos los trabajos, la conducta de los
        usuarios ni que la app esté siempre disponible. En la medida que lo permita la ley, CercaYa no es responsable por
        daños que surjan de los acuerdos o del trato entre usuarios. Te recomendamos tomar las precauciones habituales al
        contratar un servicio o recibir a alguien en tu casa.
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es importante te vamos a avisar en la app. Seguir usando CercaYa
        después de un cambio significa que lo aceptás.
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República Argentina.</p>

      <h2>Contacto</h2>
      <p>
        <a href={`mailto:${EMAIL_CONTACTO}`}>{EMAIL_CONTACTO}</a>
      </p>
    </main>
  )
}
