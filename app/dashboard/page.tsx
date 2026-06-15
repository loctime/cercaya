import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewForm from '@/components/forms/ReviewForm'

export default async function ClientDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'provider') redirect('/dashboard/provider')

  const { data: requests } = await supabase
    .from('job_requests')
    .select('*, category:categories(name, icon)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  const { data: givenReviews } = await supabase
    .from('reviews')
    .select('provider_id')
    .eq('client_id', user.id)

  const reviewedProviders = new Set(givenReviews?.map(r => r.provider_id) ?? [])

  // Find providers who applied to this client's requests (to prompt review)
  const { data: applications } = await supabase
    .from('applications')
    .select('provider_id, job:job_requests!inner(client_id), provider:profiles(full_name)')
    .eq('job.client_id', user.id)

  const pendingReviews = applications
    ?.filter(a => !reviewedProviders.has(a.provider_id))
    .reduce((acc: Array<{ provider_id: string; full_name: string }>, a) => {
      const exists = acc.find(x => x.provider_id === a.provider_id)
      if (!exists) {
        const providerProfile = a.provider as any
        acc.push({
          provider_id: a.provider_id,
          full_name: providerProfile?.full_name ?? 'Prestador',
        })
      }
      return acc
    }, []) ?? []

  const statusLabel: Record<string, string> = {
    open: 'Abierto',
    assigned: 'Asignado',
    closed: 'Cerrado',
  }
  const statusColor: Record<string, string> = {
    open: 'bg-green-100 text-green-700',
    assigned: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-500',
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>

      <Link
        href="/request/new"
        className="block text-center bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
      >
        + Publicar nuevo pedido
      </Link>

      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {(requests as any[]).map(req => (
            <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {req.category?.icon} {req.category?.name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[req.status]}`}>
                  {statusLabel[req.status]}
                </span>
              </div>
              <p className="text-sm text-gray-600">{req.description}</p>
              {req.location_label && (
                <p className="text-xs text-gray-400 mt-1">📍 {req.location_label}</p>
              )}
              {req.preferred_date && (
                <p className="text-xs text-gray-400 mt-0.5">
                  📅 {new Date(req.preferred_date + 'T00:00:00').toLocaleDateString('es-AR')}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>Todavía no publicaste ningún pedido.</p>
        </div>
      )}

      {pendingReviews.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Calificá a los prestadores</h2>
          <div className="space-y-4">
            {pendingReviews.map(p => (
              <ReviewForm
                key={p.provider_id}
                providerId={p.provider_id}
                clientId={user.id}
                providerName={p.full_name}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
