'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register'

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'client' | 'provider'>('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/')
      router.refresh()
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          role,
        })
        if (role === 'provider') {
          await supabase.from('providers').insert({ id: data.user.id, city: 'Ramallo' })
          router.push('/dashboard/provider')
        } else {
          router.push('/')
        }
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <>
            <input
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`flex-1 py-2 rounded-lg border-2 transition ${role === 'client' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
              >
                Soy cliente
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                className={`flex-1 py-2 rounded-lg border-2 transition ${role === 'provider' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}
              >
                Soy prestador
              </button>
            </div>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
        >
          {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
        </button>
      </form>

      <p className="text-center mt-4 text-sm text-gray-600">
        {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-green-600 font-semibold hover:underline"
        >
          {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
        </button>
      </p>
    </div>
  )
}
