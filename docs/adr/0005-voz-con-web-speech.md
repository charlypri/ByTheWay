# La voz es la del navegador (Web Speech API), sin audios pregenerados

> **Sustituido en parte por el [ADR 0006](0006-voz-elvira-pregenerada.md):** en castellano, la voz es Elvira, pregenerada en el despliegue. La voz del navegador queda para el inglés y para las frases sin audio.

ByTheWay lee los Anuncios y las Narraciones con la síntesis de voz que trae el móvil. La duda era si esa voz basta en los móviles reales o si hay que generar un MP3 por POI e idioma. En el #2 se probó la página `probe/voz`:

- en qué móviles: un Android con Chrome, y un iPhone con Safari y con la página instalada;
- qué se probó: voces en castellano e inglés, el primer toque, el Anuncio diferido (sin gesto, tras el desbloqueo y al volver de bloquear), la Narración frase a frase, pausar y seguir, y las locuciones largas.

Todas las pruebas salieron bien. Se había fijado un criterio antes de ver los resultados: pasar a MP3 solo si faltaba voz en castellano o si el Anuncio diferido no sonaba. No pasó ninguna de las dos cosas.

## Considered Options

- **MP3 pregenerados** (un servicio de TTS en el build o en el despliegue):
  - A favor: la voz sería mejor e igual en todos los móviles.
  - En contra: cada cambio de texto obliga a regenerar audios, y publicar dejaría de ser solo subir un KML (ADR 0004).
  - En contra: ocupan espacio, hay que descargarlos y guardarlos para funcionar sin red, y pasan a depender de un servicio de pago.
  - En contra: también necesitan desbloquear el audio con un toque.

## Consequences

- **La calidad depende de cada móvil.** En iOS la web solo recibe las voces básicas (sección 14 de la spec). El usuario puede elegir otra voz en Ajustes.
- **El Editor no tiene que hacer nada más que subir el KML.** Los textos nuevos se leen al momento.
- **Puede cambiarse después.** La voz sigue detrás de la interfaz `Narrador`, así que los MP3 podrían entrar más adelante sin tocar la guía, si algún móvil da problemas.
- **No se guardaron los informes detallados** de la página de prueba (modelos, voces elegidas, tiempos). Si un móvil da problemas, la página sigue en el repo y se abre en local (`npm run dev`) para repetir la prueba.
