/* ═══════════════════════════════════════════════════
   Alterna Apps — Service Worker
   Estrategia: NETWORK FIRST
   → Siempre intenta cargar desde la red (versión más reciente).
   → Solo usa caché si no hay conexión (modo offline).
   → Al volver a abrir la app, SIEMPRE se sirve la red.
═══════════════════════════════════════════════════ */

const CACHE_NAME = "alterna-v1";

// Archivos que se cachean para modo offline
const OFFLINE_ASSETS = [
  "./index.html",
  "./dashboard.html",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/lucide@0.383.0/dist/umd/lucide.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
];

// ── INSTALL: cachea los assets offline ──
self.addEventListener("install", (event) => {
  // Activa inmediatamente sin esperar a que cierren pestañas anteriores
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_ASSETS).catch(() => {
        // Si algún asset externo falla, no bloqueamos la instalación
      });
    })
  );
});

// ── ACTIVATE: limpia cachés viejos ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // Toma control de todas las pestañas abiertas
  );
});

// ── FETCH: Network First ──
// Intenta siempre la red. Si falla (sin conexión), usa el caché.
self.addEventListener("fetch", (event) => {
  // Solo interceptamos GET, dejamos pasar POST/PUT/DELETE (llamadas a Supabase)
  if (event.request.method !== "GET") return;

  // No interceptamos solicitudes a Supabase API (siempre deben ir a la red)
  const url = new URL(event.request.url);
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la red responde bien, actualiza el caché y devuelve la respuesta fresca
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Sin conexión: sirve desde caché
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si no hay caché del recurso, devuelve index.html como fallback
          if (event.request.destination === "document") {
            return caches.match("./index.html");
          }
        });
      })
  );
});

// ── Escucha mensajes para forzar actualización ──
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
