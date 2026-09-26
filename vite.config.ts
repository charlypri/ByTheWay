import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

interface ManifestChunk {
    file: string;
    css?: string[];
    assets?: string[];
    imports?: string[];
    dynamicImports?: string[];
}

/**
 * Genera dist/sw.js con la lista exacta de ficheros de la app: todo lo que cuelga de index.html en el
 * manifiesto del build (chunks, CSS, el worker de MapLibre), más el manifest y los iconos de public/.
 */
const serviceWorker = (): Plugin => ({
    name: 'service-worker',
    apply: 'build',
    closeBundle() {
        const dist = resolve(import.meta.dirname, 'dist');
        const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8')) as Record<string, ManifestChunk>;
        const files = new Set<string>(['', 'manifest.webmanifest', ...readdirSync(resolve(dist, 'icons')).map((f) => `icons/${f}`)]);
        const visit = (key: string) => {
            const chunk = manifest[key];
            if (!chunk || files.has(chunk.file)) return;
            files.add(chunk.file);
            [...(chunk.css ?? []), ...(chunk.assets ?? [])].forEach((f) => files.add(f));
            [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])].forEach(visit);
        };
        visit('index.html');
        const list = [...files].sort();
        const template = readFileSync(resolve(import.meta.dirname, 'sw/sw.js'), 'utf8');
        // Los nombres llevan el hash de su contenido: si cambia un fichero, cambia la versión.
        const version = createHash('sha256').update(template).update(list.join(' ')).digest('hex').slice(0, 12);
        writeFileSync(resolve(dist, 'sw.js'), template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(list, null, 4)));
    },
});

const page = (path: string) => resolve(import.meta.dirname, path);

/** Versión y commit, visibles en Ajustes para saber qué build se está probando. */
function buildName() {
    const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version: string };
    let commit = process.env.GITHUB_SHA?.slice(0, 7);
    try {
        commit ??= execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
        // sin git (p. ej. un zip del repo): solo la versión
    }
    return commit ? `${version} (${commit})` : version;
}

export default defineConfig({
    base: BASE,
    envPrefix: ['VITE_', 'TOMTOM_'],
    define: { __BUILD__: JSON.stringify(buildName()) },
    plugins: [svelte(), publishData(), serviceWorker()],
    // MapLibre usa campos de clase nativos; sin esnext sus workers fallan en silencio.
    build: {
        target: 'esnext',
        manifest: true,
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
