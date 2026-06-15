import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplyButton from './ApplyButton'

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'provider') redirect('/')

  const { data: requests } = await supabase
    .from('job_requests')
    .select('*, category:categories(name, icon), client:profiles(full_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const { data: myApplications } = await supabase
    .from('applications')
    .select('job_id')
    .eq('provider_id', user.id)

  const appliedJobIds = new Set(myApplications?.map(a => a.job_id) ?? [])

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pedidos abiertos</h1>
      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-4">
          {(requests as any[]).map(req => (
            <div key={req.id} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-lg">{req.category?.icon}</span>{' '}
                  <span className="font-semibold">{req.category?.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(req.created_at).toLocaleDateString('es-AR')}
                </span>
              </div>
              <p className="text-gray-700 text-sm mb-2">{req.description}</p>
              {req.location_label && (
                <p className="text-xs text-gray-400">📍 {req.location_label}</p>
              )}
              {req.preferred_date && (
                <p className="text-xs text-gray-400 mt-1">
                  📅 {new Date(req.preferred_date + 'T00:00:00').toLocaleDateString('es-AR')}
                </p>
              )}
              <ApplyButton
                jobId={req.id}
                providerId={user.id}
                alreadyApplied={appliedJobIds.has(req.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📋</p>
          <p>No hay pedidos abiertos por ahora.</p>
        </div>
      )}
    </main>
  )
}
