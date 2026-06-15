import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-md mx-auto text-center py-24 px-4">
      <p className="text-6xl mb-4">🌿</p>
      <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
      <p className="text-gray-500 mb-6">El contenido que buscás no existe o fue removido.</p>
      <Link
        href="/"
        className="inline-block bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
