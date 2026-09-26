import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Los KML de data/ no se empaquetan: la app los descarga en tiempo de ejecución (ADR 0004).
// En el build se copian tal cual para que los mocks y la app los encuentren junto a la web.
const copyData = (): Plugin => ({
    name: 'copy-data',
    apply: 'build',
    closeBundle() {
        cpSync(resolve(import.meta.dirname, 'data'), resolve(import.meta.dirname, 'dist/data'), { recursive: true });
    },
});

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
    base: '/ByTheWay/',
    envPrefix: ['VITE_', 'TOMTOM_'],
    plugins: [svelte(), copyData()],
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
