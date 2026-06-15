'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  jobId: string
  providerId: string
  alreadyApplied: boolean
}

export default function ApplyButton({ jobId, providerId, alreadyApplied }: Props) {
  const [applied, setApplied] = useState(alreadyApplied)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleApply() {
    setLoading(true)
    await supabase.from('applications').insert({ job_id: jobId, provider_id: providerId, message: message || null })
    setApplied(true)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  if (applied) {
    return <p className="text-sm text-green-600 font-medium">✓ Ya te postulaste</p>
  }

  return showForm ? (
    <div className="space-y-2 mt-3">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Mensaje opcional para el cliente..."
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
      />
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
        >
          {loading ? 'Enviando...' : 'Confirmar postulación'}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setShowForm(true)}
      className="w-full mt-3 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
    >
      Postularme
    </button>
  )
}
