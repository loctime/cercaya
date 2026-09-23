// La web de CercaYa dejo de ser una app instalable (ahora hay app nativa).
// Este service worker reemplaza al viejo y se desinstala solo, borrando
// sus caches, para que nadie quede con una version vieja guardada.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys()
      await Promise.all(claves.map((c) => caches.delete(c)))
      await self.registration.unregister()
      const ventanas = await self.clients.matchAll({ type: 'window' })
      ventanas.forEach((v) => v.navigate(v.url))
    })(),
  )
})
