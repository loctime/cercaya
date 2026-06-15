import { createClient } from '@/lib/supabase/server'
import CategoryPicker from '@/components/CategoryPicker'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  return (
    <main className="bg-white min-h-screen">

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-600 to-green-700 text-white px-5 pt-10 pb-16">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-block bg-green-500/40 text-green-100 text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            Ramallo y zona
          </div>
          <h1 className="text-3xl font-bold mb-3 leading-tight">
            Servicios cerca tuyo,{' '}
            <span className="text-green-200">cuando los necesitás</span>
          </h1>
          <p className="text-green-100 text-base mb-8">
            Conectamos vecinos con prestadores de confianza. Sin intermediarios, sin comisiones.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/request/new"
              className="bg-white text-green-700 px-6 py-3.5 rounded-xl font-semibold hover:bg-green-50 transition active:scale-95 shadow-sm"
            >
              Publicar un pedido
            </Link>
            <Link
              href="/providers"
              className="bg-green-500/40 text-white border border-green-400 px-6 py-3.5 rounded-xl font-semibold hover:bg-green-500/60 transition active:scale-95"
            >
              Ver prestadores
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-green-50 border-b border-green-100 px-5 py-4">
        <div className="max-w-lg mx-auto flex justify-around text-center">
          {[
            { value: '8+', label: 'categorías' },
            { value: '100%', label: 'gratuito' },
            { value: 'WA', label: 'contacto directo' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-lg font-bold text-green-700">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 py-8 max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">¿Qué necesitás?</h2>
        <CategoryPicker categories={categories ?? []} />
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-5 text-center">Cómo funciona</h2>
          <div className="flex flex-col gap-4">
            {[
              {
                step: '1',
                color: 'bg-green-100 text-green-700',
                title: 'Buscá o publicá',
                desc: 'Encontrá prestadores por categoría o publicá un pedido abierto',
              },
              {
                step: '2',
                color: 'bg-blue-100 text-blue-700',
                title: 'Contactá por WhatsApp',
                desc: 'Hablá directo con el prestador, sin pasar por la app',
              },
              {
                step: '3',
                color: 'bg-purple-100 text-purple-700',
                title: 'Calificá',
                desc: 'Dejá tu reseña y ayudá a otros vecinos a elegir',
              },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-4 bg-white rounded-2xl p-4 shadow-sm">
                <div className={`${item.color} w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0`}>
                  {item.step}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-10 text-center max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-2">¿Sos prestador de servicios?</h2>
        <p className="text-sm text-gray-500 mb-5">Registrate gratis y empezá a conseguir clientes en tu zona</p>
        <Link
          href="/auth/login"
          className="inline-block bg-green-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-green-700 transition active:scale-95"
        >
          Registrarme como prestador
        </Link>
      </section>

    </main>
  )
}
