import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, { fileName: string }>) {
      const assets = [...new Set([
        '/', '/index.html', '/manifest.webmanifest', '/favicon.ico', '/icon-192.png', '/icon-512.png',
        ...Object.values(bundle).map((output) => `/${output.fileName}`),
      ])]
      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: `const CACHE = 'cafeteria-shell-${Date.now()}';
const PRECACHE = ${JSON.stringify(assets)};
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('cafeteria-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('/index.html', copy)); return response; }).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); } return response; })));
});`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineServiceWorker()],
  server: {
    host: true,
    port: 5173,
  },
})
