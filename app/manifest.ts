import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CercaYa — Servicios cerca tuyo',
    short_name: 'CercaYa',
    description: 'Encontrá prestadores de servicios locales en Ramallo y zona',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#16a34a',
    orientation: 'portrait',
    categories: ['utilities', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
    shortcuts: [
      {
        name: 'Buscar prestadores',
        url: '/providers',
        description: 'Ver catálogo de prestadores',
      },
      {
        name: 'Publicar pedido',
        url: '/request/new',
        description: 'Crear un nuevo pedido de servicio',
      },
    ],
  }
}
