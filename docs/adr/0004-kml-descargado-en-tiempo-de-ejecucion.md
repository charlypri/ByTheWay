# La app descarga e interpreta los KML en tiempo de ejecución

El Editor tiene que poder publicar una versión nueva de los POIs sin recompilar la app ni depender de un desarrollador. Por eso los KML no se convierten en el build. Viven en la carpeta `data/` del repo (uno o varios ficheros por idioma, p. ej. `spain.es.kml` y `spain.en.kml`), el Editor los sube desde la web de GitHub, y la app los descarga en crudo al arrancar y cada 30 minutos. El KML se interpreta en el propio navegador.

Un navegador no puede listar una carpeta, así que la app necesita saber qué ficheros hay. Cada push a `main` dispara el despliegue automático que ya existe, que publica en GitHub Pages los KML tal cual y, junto a ellos, la lista `data/index.json` generada a partir de la carpeta. La app lee esa lista y descarga los ficheros de su propia web.

## Considered Options

- Convertir el KML a JSON en el build: payload más pequeño, pero ata el formato de los datos a la versión de la app.
- Gist o Google Drive/Dropbox: el Gist separa los datos del repo sin aportar nada más, y Drive/Dropbox no permiten descargarlos desde otra web (CORS) sin un backend.
- Descargar de `raw.githubusercontent.com` y listar la carpeta con la API de GitHub: evita el despliegue, pero la API sin autenticar permite 60 peticiones por hora e IP, que se agotan en redes compartidas (operador, hotel), y saca los datos a otro dominio.
- Nombres fijos (`spain.es.kml`, `spain.en.kml`): no permite sumar varios conjuntos.
- Una lista que mantiene el Editor a mano: es fácil olvidarse de añadir un fichero.

## Consequences

- Un cambio de datos tarda un par de minutos en publicarse (el despliegue) y hasta 30 minutos más en llegar a un móvil con la app abierta. Si el build de `main` falla, los datos nuevos no se publican hasta que se arregle.
- Los datos se sirven desde el mismo origen que la app: sin CORS, sin límites de peticiones y con el mismo service worker.
- La app guarda la última versión buena de cada fichero para funcionar sin red, y solo aplica una versión nueva cuando no hay una Narración en curso.
- Como el Escuchado y la Sesión se guardan por coordenadas (ADR 0003), sobreviven a los cambios de versión mientras el Editor no mueva los puntos.
- El cliente tiene que tolerar KML con errores: descripciones vacías o en HTML, formatos que no siguen la convención, puntos de test o un fichero roto (se usa su última versión buena). Se muestra lo que venga, sin bloquear (el Editor no recibe informe de validación).
