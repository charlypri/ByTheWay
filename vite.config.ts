import { cpSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const BASE = '/ByTheWay/';
const DATA = resolve(import.meta.dirname, 'data');

/** La lista de ficheros de data/: un navegador no puede listar una carpeta (ADR 0004). */
const manifest = () => JSON.stringify({ files: readdirSync(DATA).filter((f) => f.toLowerCase().endsWith('.kml')).sort() });

// Los KML de data/ no se empaquetan: la app los descarga en tiempo de ejecución (ADR 0004).
// En el build se copian tal cual junto a su lista; en desarrollo la lista se genera en cada petición.
const publishData = (): Plugin => ({
    name: 'publish-data',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (!req.url?.split('?')[0].endsWith('/data/index.json')) return next();
            res.setHeader('Content-Type', 'application/json');
            res.end(manifest());
        });
    },
    closeBundle() {
        const out = resolve(import.meta.dirname, 'dist/data');
        cpSync(DATA, out, { recursive: true });
        writeFileSync(resolve(out, 'index.json'), manifest());
    },
});

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
    base: BASE,
    envPrefix: ['VITE_', 'TOMTOM_'],
    plugins: [svelte(), publishData()],
    // MapLibre usa campos de clase nativos; sin esnext sus workers fallan en silencio.
    build: {
        target: 'esnext',
        rollupOptions: {
            input: {
                app: page('index.html'),
                mocks: page('mocks/index.html'),
                editorial: page('mocks/editorial/index.html'),
                navegador: page('mocks/navegador/index.html'),
                minima: page('mocks/minima/index.html'),
                final: page('mocks/final/index.html'),
                voz: page('probe/voz/index.html'),
            },
        },
    },
    worker: { format: 'es' },
    optimizeDeps: { esbuildOptions: { target: 'esnext' } },
    test: { environment: 'happy-dom' },
});
