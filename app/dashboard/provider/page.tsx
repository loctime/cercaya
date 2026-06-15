import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProviderProfileForm from '@/components/forms/ProviderProfileForm'
import Link from 'next/link'

export default async function ProviderDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, whatsapp_link, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'provider') redirect('/dashboard')

  const { data: provider } = await supabase
    .from('providers')
    .select('bio, price_range, city, is_approved')
    .eq('id', user.id)
    .single()

  const { data: categories } = await supabase
    .from('categories').select('*').eq('is_active', true)

  const { data: myServices } = await supabase
    .from('provider_services')
    .select('category_id')
    .eq('provider_id', user.id)

  const { data: applications } = await supabase
    .from('applications')
    .select('id, message, created_at, job:job_requests(description, location_label, category:categories(name, icon))')
    .eq('provider_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, client:profiles(full_name)')
    .eq('provider_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const avgRating = myReviews?.length
    ? myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length
    : null

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi panel</h1>
        <div className="flex items-center gap-2">
          {!provider?.is_approved ? (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
              Pendiente de aprobación
            </span>
          ) : (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
              ✓ Aprobado
            </span>
          )}
        </div>
      </div>

      {provider?.is_approved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">Tu perfil está activo</p>
            <p className="text-xs text-green-600">Los clientes pueden encontrarte en el catálogo</p>
          </div>
          <Link
            href={`/providers/${user.id}`}
            className="text-xs text-green-700 underline"
          >
            Ver mi perfil →
          </Link>
        </div>
      )}

      {avgRating && (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
          <span className="text-3xl font-bold text-yellow-400">{avgRating.toFixed(1)}</span>
          <div>
            <p className="text-sm font-medium">Tu calificación promedio</p>
            <p className="text-xs text-gray-400">{myReviews?.length} reseña{myReviews?.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Mi perfil</h2>
        <ProviderProfileForm
          userId={user.id}
          initialProfile={{
            full_name: profile?.full_name ?? '',
            phone: profile?.phone ?? null,
            whatsapp_link: profile?.whatsapp_link ?? null,
            bio: provider?.bio ?? null,
            price_range: provider?.price_range ?? null,
            city: provider?.city ?? 'Ramallo',
          }}
          categories={categories ?? []}
          selectedCategoryIds={myServices?.map(s => s.category_id) ?? []}
        />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Mis postulaciones</h2>
          <Link href="/requests" className="text-sm text-green-600 hover:underline">Ver pedidos →</Link>
        </div>
        {applications && applications.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(applications as any[]).map(app => (
              <div key={app.id} className="border rounded-lg p-3">
                <p className="font-medium text-sm">
                  {(app.job as any)?.category?.icon} {(app.job as any)?.category?.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">{(app.job as any)?.description}</p>
                {(app.job as any)?.location_label && (
                  <p className="text-xs text-gray-400 mt-1">📍 {(app.job as any)?.location_label}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Todavía no te postulaste a ningún pedido.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Mis reseñas</h2>
        {myReviews && myReviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(myReviews as any[]).map(r => (
              <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.client?.full_name}</span>
                  <span className="text-yellow-400">{'★'.repeat(r.rating)}<span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span></span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aún no tenés reseñas.</p>
        )}
      </div>
    </main>
  )
}
