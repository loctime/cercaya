import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-md mx-auto text-center py-24 px-5">
      <h1 className="font-titulo font-extrabold text-3xl mb-2">Página no encontrada</h1>
      <p className="text-texto2 mb-8">Lo que buscás no existe o se movió.</p>
      <Link href="/" className="inline-block rounded-xl bg-naranja-oscuro text-white px-6 py-3 font-semibold">
        Volver al inicio
      </Link>
    </main>
  )
}
