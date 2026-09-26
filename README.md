# Bytheway

Guía turístico virtual para el móvil. Mientras paseas, la app te dice en voz alta el nombre de cada lugar curado junto al que pasas y, si quieres, te cuenta su historia completa. Cada historia termina con un "Por cierto…".

Es una PWA sin backend: el mapa es de [TomTom](https://developer.tomtom.com/maps-sdk-js), la voz la sintetiza el propio navegador y los lugares salen de ficheros KML que el Editor prepara en Google Earth.

## Estado

En desarrollo hacia la **v0.1.0**. El trabajo se sigue en el milestone [v0.1.0](https://github.com/charlypri/ByTheWay/milestone/1).

- [Glosario del dominio](CONTEXT.md)
- [Decisiones de arquitectura](docs/adr/)

## Para el Editor: publicar lugares

1. En Google Earth Pro, guarda cada lugar como marca de posición, con su nombre y su descripción. **La distancia de la vista guardada es el radio de acción**: aleja la cámara hasta la distancia a la que quieras que salte el aviso y guarda la vista.
2. Exporta la carpeta como `.kml` (no `.kmz`).
3. Sube el fichero a [`data/`](data/) con el nombre `<conjunto>.es.kml`. Para la versión en inglés, duplica la carpeta en Google Earth, traduce los textos **sin mover los puntos** y súbela como `<conjunto>.en.kml`.

La app descarga los KML al arrancar: no hace falta desplegar nada para que los cambios lleguen a los móviles.

## Desarrollo

```sh
cp .env.example .env   # y pon tu TOMTOM_API_KEY
npm install
npm run dev            # http://localhost:5173/ByTheWay/
npm test
```
