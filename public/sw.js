// Service worker do Rota+: exibe as notificações push enviadas pelo servidor.
self.addEventListener('push', (event) => {
  const dados = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(dados.titulo ?? 'Rota+', {
      body: dados.texto ?? '',
      icon: 'favicon.svg',
      badge: 'favicon.svg',
      data: { link: dados.link ?? '/' },
    }),
  )
})

// ao tocar na notificação, abre (ou foca) o app na tela certa
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link ?? '/'
  const destino = new URL(link.startsWith('http') ? link : `./#${link}`, self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
      const aba = abertas.find((c) => c.url.startsWith(self.registration.scope))
      if (aba) {
        aba.navigate(destino)
        return aba.focus()
      }
      return self.clients.openWindow(destino)
    }),
  )
})
