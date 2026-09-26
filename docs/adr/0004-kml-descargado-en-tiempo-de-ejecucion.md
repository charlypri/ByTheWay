# La app descarga e interpreta los KML en tiempo de ejecución

El Editor tiene que poder publicar una versión nueva de los POIs sin recompilar ni desplegar la app. Por eso los KML no se convierten en el build. Viven en la carpeta `data/` del repo (un fichero por idioma, p. ej. `spain.es.kml` y `spain.en.kml`), el Editor los sube desde la web de GitHub, y la app los descarga en crudo al arrancar y cada 30 minutos. El KML se interpreta en el propio navegador.

## Considered Options

- Convertir el KML a JSON en el build: payload más pequeño, pero cada cambio de datos exige un despliegue.
- Gist o Google Drive/Dropbox: el Gist separa los datos del repo sin aportar nada más, y Drive/Dropbox no permiten descargarlos desde otra web (CORS) sin un backend.

## Consequences

- El repo tiene que ser público para servir los ficheros en crudo sin autenticación.
- La app cachea la última versión para funcionar sin red, y solo aplica una versión nueva cuando no hay una Narración en curso.
- Como el Escuchado y la Sesión se guardan por coordenadas (ADR 0003), sobreviven a los cambios de versión mientras el Editor no mueva los puntos.
- El cliente tiene que tolerar KML con errores: descripciones vacías, formatos que no siguen la convención o puntos de test. Se muestra lo que venga, sin bloquear (el Editor no recibe informe de validación).
