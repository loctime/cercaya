import { createClient } from '@/lib/supabase/server'
import ProviderCard from '@/components/ProviderCard'
import { ProviderNear } from '@/lib/types'

const RAMALLO_LAT = -33.4833
const RAMALLO_LNG = -60.0167

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ProvidersPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const catId = params.category ? parseInt(params.category) : null

  const rpcParams: Record<string, unknown> = {
    lat: RAMALLO_LAT,
    lng: RAMALLO_LNG,
    radius_km: 50,
  }
  if (catId) rpcParams.cat_id = catId

  const { data: providers } = await supabase.rpc('providers_near', rpcParams)
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  const selectedCategory = categories?.find(c => c.id === catId)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : 'Todos los prestadores'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Zona Ramallo y alrededores</p>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        <a
          href="/providers"
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${!catId ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
        >
          Todos
        </a>
        {categories?.map(cat => (
          <a
            key={cat.id}
            href={`/providers?category=${cat.id}`}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${catId === cat.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
          >
            {cat.icon} {cat.name}
          </a>
        ))}
      </div>

      {providers && providers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {(providers as ProviderNear[]).map(p => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">🌿</p>
          <p className="text-lg">No hay prestadores en esta zona aún.</p>
          <p className="text-sm mt-2">¡Sé el primero en registrarte!</p>
        </div>
      )}
    </main>
  )
}
