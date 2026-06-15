import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JobRequestForm from '@/components/forms/JobRequestForm'

export default async function NewRequestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Publicar un pedido</h1>
      <p className="text-gray-500 text-sm mb-6">Los prestadores de tu zona podrán ver tu pedido y contactarte.</p>
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <JobRequestForm categories={categories ?? []} userId={user.id} />
      </div>
    </main>
  )
}
