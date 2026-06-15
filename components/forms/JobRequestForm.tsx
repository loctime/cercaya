'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types'

export default function JobRequestForm({ categories, userId }: { categories: Category[]; userId: string }) {
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Seleccioná una categoría'); return }
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('job_requests').insert({
      client_id: userId,
      category_id: categoryId,
      description,
      location_label: locationLabel || 'Ramallo',
      location_lat: -33.4833,
      location_lng: -60.0167,
      preferred_date: preferredDate || null,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">¿Qué necesitás?</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                categoryId === cat.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="block text-sm mt-1 text-gray-700">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del trabajo</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Contanos qué necesitás con el mayor detalle posible..."
          className="w-full border rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección o barrio</label>
        <input
          type="text"
          value={locationLabel}
          onChange={e => setLocationLabel(e.target.value)}
          placeholder="Ej: Barrio Norte, Ramallo"
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha preferida (opcional)</label>
        <input
          type="date"
          value={preferredDate}
          onChange={e => setPreferredDate(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition"
      >
        {loading ? 'Publicando...' : 'Publicar pedido'}
      </button>
    </form>
  )
}
