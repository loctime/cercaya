import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="text-xl font-bold text-green-600">
        CercaYa
      </Link>

      {/* Desktop nav — hidden on mobile (BottomNav handles mobile) */}
      <div className="hidden md:flex items-center gap-4 text-sm">
        <Link href="/providers" className="text-gray-600 hover:text-green-600">
          Buscar prestadores
        </Link>

        {user ? (
          <>
            {profile?.role === 'provider' && (
              <Link href="/requests" className="text-gray-600 hover:text-green-600">
                Pedidos
              </Link>
            )}
            <Link
              href={profile?.role === 'provider' ? '/dashboard/provider' : '/dashboard'}
              className="text-gray-600 hover:text-green-600"
            >
              Mi perfil
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-gray-400 hover:text-red-500 text-xs">Salir</button>
            </form>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition"
          >
            Entrar
          </Link>
        )}
      </div>

      {/* Mobile — just show login/signout */}
      <div className="flex md:hidden items-center gap-3">
        {user ? (
          <form action="/auth/signout" method="post">
            <button className="text-gray-400 hover:text-red-500 text-xs">Salir</button>
          </form>
        ) : (
          <Link
            href="/auth/login"
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            Entrar
          </Link>
        )}
      </div>
    </nav>
  )
}
