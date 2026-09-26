# El Radio de acción se lee de `LookAt.range` del KML

El formato KML que exporta Google Earth Pro no tiene un campo de radio, y Google Earth Pro no ofrece una interfaz cómoda para ExtendedData. El Editor ya fija el radio de cada POI guardando la vista de la cámara a esa distancia (el "Punto de test" del primer dataset dice "definido con 20000 metros de distancia" y su `LookAt.range` es 20000). Formalizamos esa convención: el Radio de acción de un POI, en metros, es el `<LookAt><range>` de su `<Placemark>`.

## Consequences

- Cambiar el encuadre de cámara de un POI en Google Earth cambia su radio. Es una fuente de errores silenciosos que el validador del dataset debe señalar (valores ausentes, 0 o anormalmente grandes).
- Si en el futuro el Editor usa otra herramienta, habrá que migrar a un campo explícito.
