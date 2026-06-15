import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import WhatsAppButton from '@/components/WhatsAppButton'
import StarRating from '@/components/StarRating'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProviderProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, whatsapp_link, phone')
    .eq('id', id)
    .single()

  const { data: provider } = await supabase
    .from('providers')
    .select('bio, price_range, city, coverage_radius_km, is_approved')
    .eq('id', id)
    .single()

  if (!profile || !provider || !provider.is_approved) notFound()

  const { data: services } = await supabase
    .from('provider_services')
    .select('categories(id, name, icon)')
    .eq('provider_id', id)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, client:profiles(full_name, avatar_url)')
    .eq('provider_id', id)
    .order('created_at', { ascending: false })

  const avgRating = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  const contactPhone = profile.whatsapp_link || profile.phone || ''
  const categories = services?.flatMap(s => (s.categories ? [s.categories] : [])) as Array<{ id: number; name: string; icon: string }>

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex gap-4 items-start mb-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <span className="text-3xl text-gray-400 font-semibold">
                {profile.full_name[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
            <p className="text-gray-500 text-sm">{provider.city}</p>
            <StarRating rating={avgRating} count={reviews?.length ?? 0} />
          </div>
        </div>

        {provider.bio && <p className="text-gray-700 mb-4">{provider.bio}</p>}

        {provider.price_range && (
          <p className="text-green-700 font-medium mb-4">💰 {provider.price_range}</p>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(cat => (
              <span key={cat.id} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                {cat.icon} {cat.name}
              </span>
            ))}
          </div>
        )}

        {contactPhone ? (
          <WhatsAppButton
            phone={contactPhone}
            providerName={profile.full_name}
            categoryName={categories[0]?.name}
          />
        ) : (
          <p className="text-center text-sm text-gray-400 py-2">Este prestador aún no cargó su número de contacto.</p>
        )}
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Reseñas ({reviews?.length ?? 0})</h2>
        {reviews && reviews.length > 0 ? (
          <div className="flex flex-col gap-4">
            {(reviews as Array<{ id: string; rating: number; comment: string | null; client: { full_name: string } | null }>).map(r => (
              <div key={r.id} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.client?.full_name ?? 'Cliente'}</span>
                  <div className="flex">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} className={i <= r.rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Aún no hay reseñas para este prestador.</p>
        )}
      </div>
    </main>
  )
}
