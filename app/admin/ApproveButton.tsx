'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ApproveButton({ providerId }: { providerId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function approve() {
    setLoading(true)
    await supabase.from('providers').update({ is_approved: true }).eq('id', providerId)
    setDone(true)
    setLoading(false)
    router.refresh()
  }

  if (done) return <span className="text-green-600 text-sm font-medium">✓ Aprobado</span>

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition"
    >
      {loading ? '...' : 'Aprobar'}
    </button>
  )
}
