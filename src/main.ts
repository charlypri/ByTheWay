import { mount } from 'svelte';
import App from './App.svelte';
import { App as GuideApp } from './app/app.svelte';
import { webAudioChime } from './app/chime';
import { Catalog, httpText } from './lib/catalog';
import { browserNarrator } from './lib/narrator';
import { browserGps } from './lib/position';
import { localStore } from './lib/storage';
import { keepScreenOn } from './lib/wakelock';
import { createGuideMap } from './map/guide-map';
import './ui/styles.css';

const store = localStore();
const dark = matchMedia('(prefers-color-scheme: dark)');

const app = new GuideApp({
    store,
    catalog: new Catalog({
        fetchText: httpText,
        store,
        dataUrl: `${import.meta.env.BASE_URL}data/`,
        now: Date.now,
        every: (fn, ms) => {
            const id = setInterval(fn, ms);
            return () => clearInterval(id);
        },
    }),
    narrator: browserNarrator(store),
    position: browserGps(),
    now: Date.now,
    systemDark: { matches: () => dark.matches, onChange: (fn) => dark.addEventListener('change', fn) },
    createMap: (container, opts) => createGuideMap(container, opts),
    chime: webAudioChime(),
    keepScreenOn: () => keepScreenOn(navigator, document),
});

mount(App, { target: document.getElementById('app')!, props: { app } });

// Service worker: la app funciona sin red (sección 13). Solo en el build, para no cachear el desarrollo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {
        // sin service worker, la app funciona igual con red
    });
}

// Para depurar desde la consola; no llega al build de producción.
if (import.meta.env.DEV) (window as unknown as { app: GuideApp }).app = app;
