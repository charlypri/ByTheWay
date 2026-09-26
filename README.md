# ByTheWay

Guía turístico virtual para el móvil. Mientras paseas, la app te dice en voz alta el nombre de cada lugar curado junto al que pasas y, si quieres, te cuenta su historia completa. Cada historia termina con un "Por cierto…".

Es una PWA sin backend: el mapa es de [TomTom](https://developer.tomtom.com/maps-sdk-js), la voz la sintetiza el propio navegador y los lugares salen de ficheros KML que el Editor prepara en Google Earth.

## Estado

En desarrollo hacia la **v0.1.0**. El trabajo se sigue en el milestone [v0.1.0](https://github.com/charlypri/ByTheWay/milestone/1).

- [Glosario del dominio](CONTEXT.md)
- [Decisiones de arquitectura](docs/adr/)

## Para el Editor: publicar lugares

1. En Google Earth Pro, guarda cada lugar como marca de posición, con su nombre y su descripción. **La distancia de la vista guardada es el radio de acción**: aleja la cámara hasta la distancia a la que quieras que salte el aviso y guarda la vista.
2. Exporta la carpeta como `.kml` (no `.kmz`).
3. Sube el fichero a [`data/`](data/) desde la web de GitHub (*Add file → Upload files*, en la rama `main`) con el nombre `<conjunto>.es.kml`. Para la versión en inglés, duplica la carpeta en Google Earth, traduce los textos **sin mover los puntos** y súbela como `<conjunto>.en.kml`.

Puedes tener varios conjuntos (`retiro.es.kml`, `rioja.es.kml`…): la app los suma. Un fichero sin `.es` o `.en` antes de `.kml` no se carga. Si un mismo punto aparece en dos ficheros, vale el del fichero que va antes por orden alfabético.

Al subir un fichero se publica solo en un par de minutos (pestaña *Actions*), y los móviles que tengan la app abierta lo reciben en menos de 30 minutos. No hace falta tocar nada más.

Para probar los lugares sin salir de casa, abre la app con `?sim` al final de la dirección (por ejemplo, `…/ByTheWay/?sim`). Aparece el chip *Simulador*: da un paseo por el Retiro a pie, en bici o en coche, y en cualquier otra zona basta con arrastrar la flecha hasta el lugar.

## Desarrollo

```sh
cp .env.example .env   # y pon tu TOMTOM_API_KEY
npm install
npm run dev            # http://localhost:5173/ByTheWay/
npm test
```

GitHub Pages publica solo la app. Lo demás se abre en local con `npm run dev`:

- Mock final, la referencia visual de la spec: http://localhost:5173/ByTheWay/mocks/final/
- Prueba de voz (#2): http://localhost:5173/ByTheWay/probe/voz/. Para abrirla desde el móvil, `npm run dev -- --host` y la IP del ordenador en la misma Wi-Fi.
