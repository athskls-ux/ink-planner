// Offline support: the app shell and word lists are cached; recognition requests always go to the network.
const CACHE = "ink-planner-v1";
const SHELL = ["./", "index.html", "css/app.css", "icon.svg", "manifest.webmanifest",
  "js/app.js", "js/store.js", "js/ink.js", "js/templates.js", "js/recognize.js", "js/lexicon.js", "js/dates.js",
  "data/el-words.txt", "data/en-words.txt"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Network first for our own files (so updates show up), cache as the offline fallback.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
