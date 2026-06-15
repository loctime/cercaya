'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Category } from '@/lib/types'

interface Props {
  userId: string
  initialProfile: {
    full_name: string
    phone: string | null
    whatsapp_link: string | null
    bio: string | null
    price_range: string | null
    city: string
  }
  categories: Category[]
  selectedCategoryIds: number[]
}

export default function ProviderProfileForm({ userId, initialProfile, categories, selectedCategoryIds }: Props) {
  const [fullName, setFullName] = useState(initialProfile.full_name)
  const [phone, setPhone] = useState(initialProfile.phone ?? '')
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [priceRange, setPriceRange] = useState(initialProfile.price_range ?? '')
  const [city, setCity] = useState(initialProfile.city)
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set(selectedCategoryIds))
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  function toggleCat(id: number) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase.from('profiles').update({
      full_name: fullName,
      phone,
      whatsapp_link: phone,
    }).eq('id', userId)

    await supabase.from('providers').update({
      bio: bio || null,
      price_range: priceRange || null,
      city,
    }).eq('id', userId)

    await supabase.from('provider_services').delete().eq('provider_id', userId)
    if (selectedCats.size > 0) {
      await supabase.from('provider_services').insert(
        Array.from(selectedCats).map(catId => ({ provider_id: userId, category_id: catId }))
      )
    }

    setSaved(true)
    setLoading(false)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Teléfono</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+54911..."
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-xs text-gray-400 mt-1">Los clientes te contactarán por este número</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Bio</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          placeholder="Contá tu experiencia, años en el rubro, zona donde trabajás..."
          className="w-full border rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Precio estimado</label>
        <input
          value={priceRange}
          onChange={e => setPriceRange(e.target.value)}
          placeholder="Ej: $2.000 - $5.000 por visita"
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Servicios que ofrecés</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCat(cat.id)}
              className={`p-2 rounded-lg border-2 text-left text-sm transition ${
                selectedCats.has(cat.id) ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition"
      >
        {loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar perfil'}
      </button>
    </form>
  )
}
