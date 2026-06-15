import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import PWAInstallButton from '@/components/PWAInstallButton'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CercaYa — Servicios cerca tuyo',
  description: 'Encontrá prestadores de confianza en Ramallo y zona',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CercaYa',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-gray-50 min-h-screen pb-16 md:pb-0`}>
        <Navbar />
        {children}
        <BottomNav />
        <PWAInstallButton />
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {})
              })
            }
          `}
        </Script>
      </body>
    </html>
  )
}
