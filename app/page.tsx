import Image from 'next/image'
import Link from 'next/link'
import { EMAIL_CONTACTO } from '@/lib/sitio'

const RUBROS = [
  'Corte de pasto',
  'Poda de árboles',
  'Limpieza de jardín',
  'Plomería',
  'Electricidad',
  'Pintura',
  'Albañilería',
  'Limpieza del hogar',
]

const PASOS = [
  {
    titulo: 'Contá qué necesitás',
    texto: 'Publicá tu pedido con fotos, o buscá directamente entre los prestadores de tu zona.',
  },
  {
    titulo: 'Hablá con quien te interese',
    texto: 'Chateá desde la app. Tu número y tu dirección no se muestran salvo que vos decidas compartirlos.',
  },
  {
    titulo: 'Calificá el trabajo',
    texto: 'Cuando termina, los dos se califican. Las reseñas son solo de trabajos reales hechos por CercaYa.',
  },
]

export default function Inicio() {
  return (
    <main>
      <section className="bg-naranja-suave">
        <div className="max-w-4xl mx-auto px-5 py-16 sm:py-24 grid sm:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-naranja-oscuro mb-3">Ramallo, Villa Ramallo, Pérez Millán y zona</p>
            <h1 className="font-titulo font-extrabold text-4xl sm:text-5xl leading-tight mb-5">
              Servicios de confianza, cerca tuyo
            </h1>
            <p className="text-lg text-slate-700 mb-8 max-w-xl">
              Encontrá plomeros, electricistas, jardineros y más oficios de tu zona. Mirá sus trabajos y reseñas, chateá y
              coordiná directo con ellos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <span className="inline-flex items-center justify-center rounded-xl bg-tinta text-white px-6 py-3.5 font-semibold">
                Muy pronto en Google Play
              </span>
              <span className="inline-flex items-center justify-center rounded-xl border-2 border-tinta px-6 py-3 font-semibold">
                Muy pronto en App Store
              </span>
            </div>
          </div>
          <Image
            src="/logo.png"
            alt="Logo de CercaYa: un pin de ubicación con una casa"
            width={207}
            height={256}
            className="mx-auto w-36 sm:w-52 h-auto"
            priority
          />
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-titulo font-extrabold text-3xl mb-10">Cómo funciona</h2>
        <ol className="grid sm:grid-cols-3 gap-8">
          {PASOS.map((p, i) => (
            <li key={p.titulo}>
              <span className="inline-flex w-10 h-10 rounded-full bg-naranja text-tinta font-titulo font-extrabold items-center justify-center mb-4">
                {i + 1}
              </span>
              <h3 className="font-titulo font-extrabold text-xl mb-2">{p.titulo}</h3>
              <p className="text-slate-700 leading-relaxed">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-grupo border-y border-borde">
        <div className="max-w-4xl mx-auto px-5 py-16 grid sm:grid-cols-2 gap-10">
          <div>
            <h2 className="font-titulo font-extrabold text-3xl mb-4">Tu privacidad, primero</h2>
            <ul className="space-y-3 text-slate-700 leading-relaxed">
              <li>Nadie ve tu dirección ni tu ubicación exacta: solo la localidad y una distancia aproximada.</li>
              <li>Tu número está oculto por defecto. Lo mostrás o lo compartís en un chat solo si querés.</li>
              <li>Podés bloquear y denunciar a cualquier usuario, y borrar tu cuenta cuando quieras.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-titulo font-extrabold text-3xl mb-4">Ofrecés un oficio?</h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              Sumá tus servicios gratis desde la app, mostrá fotos de tus trabajos y recibí consultas y avisos de pedidos de
              tu rubro en tu zona. Revisamos cada perfil antes de publicarlo.
            </p>
            <ul className="flex flex-wrap gap-2">
              {RUBROS.map((r) => (
                <li key={r} className="rounded-full bg-white border border-borde px-3 py-1 text-sm font-medium">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 py-16">
        <h2 className="font-titulo font-extrabold text-3xl mb-4">Tenés dudas?</h2>
        <p className="text-slate-700 leading-relaxed">
          Mirá la <Link href="/soporte" className="text-naranja-oscuro underline">página de ayuda</Link> o escribinos a{' '}
          <a href={`mailto:${EMAIL_CONTACTO}`} className="text-naranja-oscuro underline">
            {EMAIL_CONTACTO}
          </a>
          .
        </p>
      </section>
    </main>
  )
}
