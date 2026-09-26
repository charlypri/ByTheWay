// Service worker de Bytheway (sección 13). Lo genera el build, que rellena VERSION y PRECACHE
// con la lista exacta de ficheros de la app. Nada sale del móvil salvo las peticiones del mapa.
const VERSION = '__VERSION__';
/** Rutas relativas al scope: la app, sus chunks, el worker de MapLibre, el manifest y los iconos. */
const PRECACHE = __PRECACHE__;

const APP_CACHE = `btw-app-${VERSION}`;
const DATA_CACHE = 'btw-data';
const FONT_CACHE = 'btw-fonts';
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE)))));
});

// Una versión nueva espera a que se cierren todas las pestañas: la página abierta sigue con sus
// propios ficheros hasta el final, y no pide chunks que ya no existen en el servidor.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('btw-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)) {
        const path = url.pathname.slice(SCOPE.pathname.length);
        // Los KML, primero de la red: una versión nueva tiene que llegar en menos de 30 minutos.
        if (path.startsWith('data/')) return event.respondWith(networkFirst(request, DATA_CACHE));
        // La app arranca sin red: cualquier navegación dentro del scope abre la app.
        if (request.mode === 'navigate') return event.respondWith(cacheFirst(new Request(SCOPE), APP_CACHE));
        return event.respondWith(cacheFirst(request, APP_CACHE));
    }

    // Tipografías de Google Fonts: se guardan al verlas y se refrescan en segundo plano.
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        return event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    }
    // Teselas y estilos de TomTom: sin caché propia (condiciones de TomTom), solo la del navegador.
});

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
    return response;
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw error;
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const fresh = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached ?? fresh;
}
