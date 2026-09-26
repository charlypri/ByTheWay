# Cada idioma es un KML aparte y los POIs se emparejan por coordenadas

Todo el contenido existe solo en castellano. En lugar de traducirlo automáticamente en el build, el Editor entrega un KML por idioma: duplica la carpeta en Google Earth y traduce el título y la descripción sin mover los puntos. Los POIs de distintos idiomas se emparejan por coordenadas (tolerancia ≤ 1 m), porque los nombres cambian al traducirse y además no son únicos (ya hay "Biblioteca Popular", "Sancho IV" y "Fuentes de la Bellota" repetidos).

## Considered Options

- Traducción con LLM en el build: se descartó porque el Editor quiere controlar el texto de cada idioma.
- Emparejar por orden en el fichero o por un código en el nombre: el primero es frágil y el segundo, feo y manual.

## Consequences

- Si el Editor mueve un punto en un solo idioma, rompe la pareja. Un POI sin traducción se presenta en castellano.
- Dos POIs distintos no pueden compartir coordenadas.
