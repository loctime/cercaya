'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  providerId: string
  clientId: string
  providerName: string
}

export default function ReviewForm({ providerId, clientId, providerName }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    setLoading(true)
    await supabase.from('reviews').upsert({
      provider_id: providerId,
      client_id: clientId,
      rating,
      comment: comment || null,
    }, { onConflict: 'provider_id,client_id' })
    setDone(true)
    setLoading(false)
    router.refresh()
  }

  if (done) return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
      ✓ Reseña enviada para {providerName}. ¡Gracias!
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-xl bg-gray-50">
      <p className="font-medium text-sm">Calificá a <span className="text-green-700">{providerName}</span></p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            className={`text-2xl transition ${i <= (hovered || rating) ? 'text-yellow-400' : 'text-gray-300'}`}
          >★</button>
        ))}
        {rating > 0 && <span className="text-xs text-gray-500 ml-1 self-center">{rating}/5</span>}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Contá tu experiencia (opcional)"
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
      />
      <button
        type="submit"
        disabled={!rating || loading}
        className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition"
      >
        {loading ? 'Enviando...' : 'Enviar reseña'}
      </button>
    </form>
  )
}
