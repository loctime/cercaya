import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApproveButton from './ApproveButton'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/')

  const { data: pending } = await supabase
    .from('providers')
    .select('id, city, created_at, profile:profiles(full_name, phone)')
    .eq('is_approved', false)
    .order('created_at')

  const { data: allUsers } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const stats = {
    total: allUsers?.length ?? 0,
    providers: allUsers?.filter(u => u.role === 'provider').length ?? 0,
    clients: allUsers?.filter(u => u.role === 'client').length ?? 0,
    pending: pending?.length ?? 0,
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Panel Admin</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Usuarios', value: stats.total },
          { label: 'Clientes', value: stats.clients },
          { label: 'Prestadores', value: stats.providers },
          { label: 'Pendientes', value: stats.pending, highlight: stats.pending > 0 },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 text-center ${s.highlight ? 'bg-yellow-50 border border-yellow-200' : 'bg-white shadow-sm'}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">
          Prestadores pendientes de aprobación ({pending?.length ?? 0})
        </h2>
        {pending && pending.length > 0 ? (
          <div className="flex flex-col gap-3">
            {(pending as any[]).map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="font-medium">{p.profile?.full_name}</p>
                  <p className="text-sm text-gray-500">
                    {p.profile?.phone ? `📱 ${p.profile.phone}` : 'Sin teléfono'} · {p.city}
                  </p>
                  <p className="text-xs text-gray-400">
                    Registrado: {new Date(p.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <ApproveButton providerId={p.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay prestadores pendientes. ✓</p>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Usuarios recientes</h2>
        <div className="flex flex-col gap-1">
          {(allUsers as any[])?.map(u => (
            <div key={u.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
              <span className="text-gray-800">{u.full_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(u.created_at).toLocaleDateString('es-AR')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  u.role === 'provider' ? 'bg-green-100 text-green-700' :
                  u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{u.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
