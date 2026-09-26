// Presupuesto de la sección 12: el JS inicial de la app, incluido MapLibre, no pasa de 350 KB gzip.
// Cuenta lo que carga index.html (script de entrada y modulepreload); los chunks a demanda no cuentan.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 350_000;
const html = readFileSync('dist/index.html', 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href)="\/ByTheWay\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
let total = 0;
for (const file of files) {
    const size = gzipSync(readFileSync(`dist/${file}`), { level: 9 }).length;
    total += size;
    console.log(`${(size / 1000).toFixed(1).padStart(8)} KB  ${file}`);
}
console.log(`${(total / 1000).toFixed(1).padStart(8)} KB  total (límite ${BUDGET / 1000} KB)`);
if (total > BUDGET) {
    console.error('El JS inicial supera el presupuesto de la sección 12 de la especificación.');
    process.exit(1);
}
