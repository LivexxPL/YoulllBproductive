/* Service worker YoulllBproductive
 * - przyciski w powiadomieniach (Zrobione / Drzemka),
 * - proste działanie offline (cache plików aplikacji).
 * Uwaga: SW NIE planuje powiadomień – przeglądarki tego nie umożliwiają,
 * dlatego przypomnienia w wersji webowej działają przy otwartej karcie.
 */
const CACHE = 'ybp-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/sounds/alarm.wav'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Strona: najpierw sieć (świeża wersja), offline – z cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Zasoby z hashem w nazwie, ikony, dźwięki: cache, potem sieć
  if (/^\/(assets|icons|sounds)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const data = n.data || {};
  const action = event.action || 'open';
  n.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all.find((c) => c.url.startsWith(self.registration.scope));
      if (client) {
        await client.focus().catch(() => {});
        client.postMessage({ type: 'notification-action', action, reminderId: data.reminderId, occurrence: data.occurrence });
      } else if (data.reminderId) {
        const q = new URLSearchParams({ action, r: data.reminderId, o: data.occurrence || '' });
        await self.clients.openWindow(`/?${q.toString()}#/dzis`);
      } else {
        await self.clients.openWindow('/#/dzis');
      }
    })(),
  );
});
