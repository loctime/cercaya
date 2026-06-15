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
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Servicios cerca tuyo, <span className="text-green-600">ahora</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          Encontrá prestadores de confianza en Ramallo y zona
        </p>
        <Link
          href="/request/new"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition"
        >
          Publicar un pedido
        </Link>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-4">¿Qué necesitás?</h2>
      <CategoryPicker categories={categories ?? []} />

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[
          { icon: '🔍', title: 'Encontrá', desc: 'Buscá prestadores cerca tuyo por categoría y zona' },
          { icon: '💬', title: 'Contactá', desc: 'Hablá directo por WhatsApp, sin intermediarios' },
          { icon: '⭐', title: 'Calificá', desc: 'Dejá tu reseña y ayudá a la comunidad' },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-4xl mb-3">{item.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
