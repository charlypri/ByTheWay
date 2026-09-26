import { mount } from 'svelte';
import App from './App.svelte';
import { App as GuideApp } from './app/app.svelte';
import { Catalog, httpText } from './lib/catalog';
import { browserNarrator } from './lib/narrator';
import { browserGps } from './lib/position';
import { localStore } from './lib/storage';
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
});

mount(App, { target: document.getElementById('app')!, props: { app } });

// Para depurar desde la consola; no llega al build de producción.
if (import.meta.env.DEV) (window as unknown as { app: GuideApp }).app = app;
