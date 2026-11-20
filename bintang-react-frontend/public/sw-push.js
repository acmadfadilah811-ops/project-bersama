/* Service worker notifikasi Web Push ERP (2026-10-21).
 * Menampilkan notifikasi dari server walaupun tab ERP ditutup; klik notifikasi membuka
 * halaman tujuan (mis. /sesi-foto). Tidak meng-cache apa pun. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { pesan: event.data ? event.data.text() : '' };
  }
  const judul = data.judul || 'Notifikasi ERP';
  event.waitUntil(
    self.registration.showNotification(judul, {
      body: data.pesan || '',
      icon: '/logo192.png',
      badge: '/logo64.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tujuan = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((daftar) => {
      for (const klien of daftar) {
        if (klien.url.startsWith(self.location.origin) && 'focus' in klien) {
          klien.navigate(tujuan);
          return klien.focus();
        }
      }
      return self.clients.openWindow(tujuan);
    }),
  );
});
