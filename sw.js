// Vendor Soft - Offline Service Worker v44
const CACHE_NAME = "vendorsoft-v44";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./view_bill.html",
  "./css/style.css",
  "./js/i18n.js",
  "./js/db.js",
  "./js/qrcode.js",
  "./js/app.js",
  "./manifest.json",
  "./vendorsoft_imported_data.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first for dynamic content, cache fallback for offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
