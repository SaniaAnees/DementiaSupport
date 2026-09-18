// Service Worker — offline-first, cache API responses
const CACHE_NAME = 'mindcare-v82-welcome-auto';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/splash-home.jpg',
  '/images/splash-brand.png',
  '/images/mindcare-logo-mark.png',
  '/images/app-backdrop.png',
  '/images/app-backdrop.jpg',
  '/images/auth-backdrop.jpg',
  '/images/onboard-backdrop.jpg',
  '/images/intro/p1.png',
  '/images/intro/p2.png',
  '/images/intro/p3.png',
  '/images/intro/p4.png',
  '/images/intro/p5.png',
  '/images/intro/p7.png',
  '/images/intro/p8.png',
  '/css/tokens.css',
  '/css/splash.css',
  '/css/intro.css',
  '/css/auth.css',
  '/css/onboard.css',
  '/css/caregiver.css',
  '/css/patient.css',
  '/js/app.js',
  '/js/features/intro.js',
  '/js/features/onboard.js',
  '/js/db.js',
  '/js/api.js',
  '/js/sync.js',
  '/js/auth/session.js',
  '/js/auth/otp.js',
  '/js/auth/pin.js',
  '/js/engine/sessionBuilder.js',
  '/js/engine/grading.js',
  '/js/engine/scoring.js',
  '/js/voice/phrases.js',
  '/js/voice/sessionI18n.js',
  '/js/voice/voiceLayer.js',
  '/js/features/caregiver/heroInsights.js',
  '/js/features/caregiver/healthInsights.js',
  '/js/features/caregiver/dashboardEngine.js',
  '/js/features/caregiver/wellnessCheckins.js',
  '/js/features/caregiver/home.js',
  '/js/features/caregiver/patientEditor.js',
  '/js/features/caregiver/analytics.js',
  '/js/features/patient/patientHome.js',
  '/js/features/patient/sessionStart.js',
  '/js/features/patient/sessionPlay.js',
  '/js/features/patient/sessionSummary.js',
];

self.addEventListener('install', (event) => {
  // Cache in the background — don't fail install if one asset 404s
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests — network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // JS / CSS — network first so voice UX updates are never stuck behind old SW cache
  if (
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/css/') ||
    url.pathname === '/index.html' ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other static assets — cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(self.syncQueue());
  }
});

async function syncQueue() {
  const clients = await self.clients.matchAll();
  clients.forEach((c) => c.postMessage({ type: 'SYNC' }));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
