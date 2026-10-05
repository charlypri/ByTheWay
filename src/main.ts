import { mount } from 'svelte';
import App from './App.svelte';
import { App as GuideApp } from './app/app.svelte';
import { webAudioChime } from './app/chime';
import { Catalog, httpText } from './lib/catalog';
import { audioClips } from './lib/clips';
import { browserNarrator } from './lib/narrator';
import { browserGps, type PositionSource } from './lib/position';
import { localStore } from './lib/storage';
import { keepScreenOn } from './lib/wakelock';
import { createGuideMap } from './map/guide-map';
import './ui/styles.css';

const store = localStore();
const gps = browserGps();
// ?sim cambia el GPS por un paseo simulado por el Retiro; sin ?sim, su código ni se descarga.
// Sin await de primer nivel: con él, el bundler parte el chunk inicial en trozos y pesa más.
const sim = new URLSearchParams(location.search).has('sim')
    ? import('./lib/simulator').then(
          ({ Simulator }) =>
              new Simulator({
                  now: Date.now,
                  every: (fn, ms) => {
                      const id = setInterval(fn, ms);
                      return () => clearInterval(id);
                  },
                  random: Math.random,
                  gps,
              }),
      )
    : undefined;
/** El simulador llega por la red; las llamadas esperan a que esté, en el mismo orden. */
const position: PositionSource = sim
    ? {
          start: (onFix, onError) => void sim.then((s) => s.start(onFix, onError)),
          stop: () => void sim.then((s) => s.stop()),
      }
    : gps;
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
    narrator: browserNarrator(store, audioClips(import.meta.env.BASE_URL)),
    position,
    now: Date.now,
    systemDark: { matches: () => dark.matches, onChange: (fn) => dark.addEventListener('change', fn) },
    createMap: (container, opts) => createGuideMap(container, opts),
    chime: webAudioChime(),
    keepScreenOn: () => keepScreenOn(navigator, document),
});

mount(App, { target: document.getElementById('app')!, props: { app, sim } });

// Service worker: la app funciona sin red (sección 13). Solo en el build, para no cachear el desarrollo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {
        // sin service worker, la app funciona igual con red
    });
}

// Para depurar desde la consola; no llega al build de producción.
if (import.meta.env.DEV) (window as unknown as { app: GuideApp }).app = app;
