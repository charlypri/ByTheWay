// Genera los audios de la voz Elvira (ADR 0006) para todas las frases de los KML en castellano.
// Los guarda en .voice/ con el hash de su texto como nombre; el build copia a dist/audio/ los de
// .voice/index.json. Solo genera los que faltan y borra los que ya no se usan.
//
// Necesita Python con edge-tts (`pip install edge-tts`). Si edge-tts falla, avisa y sale bien:
// las frases sin audio las lee la voz del navegador.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { runnerImport } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, '.voice');
const load = async (path) => (await runnerImport(resolve(ROOT, path), { configFile: false, logLevel: 'error' })).module;

// parseKml usa DOMParser, que Node no tiene.
globalThis.DOMParser = new Window().DOMParser;
const { parseKml, langOfFile } = await load('src/lib/kml.ts');
const { CLIP_LANG, CLIP_VOICE, clipKey, clipTexts } = await load('src/lib/clips.ts');
const { t } = await load('src/lib/i18n.ts');

// La muestra de Ajustes también: al elegir la voz se oye Elvira y no la del navegador.
const texts = new Set([t(CLIP_LANG, 'voiceSample')]);
for (const file of readdirSync(resolve(ROOT, 'data'))) {
    if (langOfFile(file) !== CLIP_LANG) continue;
    for (const p of parseKml(readFileSync(resolve(ROOT, 'data', file), 'utf8'))) clipTexts(p.title, p.description).forEach((text) => texts.add(text));
}

mkdirSync(OUT, { recursive: true });
const clips = await Promise.all([...texts].map(async (text) => ({ text, file: `${await clipKey(text)}.mp3` })));
const wanted = new Set(clips.map((c) => c.file));
for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !wanted.has(f)) rmSync(resolve(OUT, f));

const missing = clips.filter((c) => !existsSync(resolve(OUT, c.file)));
console.log(`${clips.length} frases, ${clips.length - missing.length} ya generadas, ${missing.length} por generar.`);
if (missing.length) {
    const voice = CLIP_VOICE.id.replace(/^clips:/, '');
    const python = process.env.PYTHON ?? 'python';
    const run = spawnSync(python, [resolve(ROOT, 'scripts/voice.py'), voice, OUT], {
        input: JSON.stringify(missing),
        stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (run.status !== 0) console.warn('No se pudieron generar todos los audios: esas frases las leerá la voz del navegador.');
}

const ready = clips.filter((c) => existsSync(resolve(OUT, c.file))).map((c) => c.file);
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(ready.sort()));
console.log(`${ready.length} de ${clips.length} frases con audio.`);
