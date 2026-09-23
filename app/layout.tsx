import type { Metadata, Viewport } from 'next'
import { Inter, Nunito } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import './globals.css'

// La web es la vidriera de la app: landing, páginas legales y soporte.
// El uso (buscar, pedir, chatear) vive en la app (movil/).

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const nunito = Nunito({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-nunito' })

export const metadata: Metadata = {
  metadataBase: new URL('https://cercaya.controlapps.ar'),
  title: { default: 'CercaYa — Servicios de confianza cerca tuyo', template: '%s — CercaYa' },
  description:
    'Encontrá plomeros, electricistas, jardineros y más en Ramallo y zona. Chateá, coordiná y calificá, sin dar tu número si no querés.',
  openGraph: {
    title: 'CercaYa — Servicios de confianza cerca tuyo',
    description: 'Prestadores de Ramallo y zona, con reseñas de trabajos reales.',
    locale: 'es_AR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#FE6F14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${nunito.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <header className="border-b border-borde">
          <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="CercaYa, inicio">
              <Image src="/logo.png" alt="" width={28} height={34} priority />
              <span className="font-titulo font-extrabold text-xl">CercaYa</span>
            </Link>
            <nav className="flex gap-5 text-sm font-medium text-texto2">
              <Link href="/soporte" className="hover:text-tinta">
                Ayuda
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-borde bg-grupo">
          <div className="max-w-4xl mx-auto px-5 py-8 flex flex-col sm:flex-row gap-4 justify-between text-sm text-texto2">
            <p>© {new Date().getFullYear()} CercaYa · Ramallo, Buenos Aires</p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/soporte" className="hover:text-tinta">Ayuda y soporte</Link>
              <Link href="/terminos" className="hover:text-tinta">Términos</Link>
              <Link href="/privacidad" className="hover:text-tinta">Privacidad</Link>
              <Link href="/borrar-cuenta" className="hover:text-tinta">Borrar mi cuenta</Link>
            </nav>
          </div>
        </footer>

        {/* La web vieja se instalaba como app: este script apaga ese service worker. */}
        <Script id="sw-limpieza" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update()))`}
        </Script>
      </body>
    </html>
  )
}
