# En castellano, la voz es Elvira, pregenerada en el despliegue

Sustituye en parte al ADR 0005. En Safari para iPhone la voz del navegador sonaba robótica por dos motivos:

- **iOS no da a la web sus voces buenas.** Safari solo recibe las voces básicas, aunque el usuario haya descargado las mejoradas.
- **La elección automática caía en las voces Eloquence** (Eddy, Flo, Grandma…), que iOS da en todos los idiomas y van primero por orden alfabético.

Ahora el despliegue genera un audio MP3 por frase con la voz neuronal **Elvira** (es-ES) de Microsoft, usando [edge-tts](https://github.com/rany2/edge-tts).

- **Qué se genera:** el título de cada POI (el Anuncio), las frases de su Narración y la muestra de Ajustes. Son unas 570 frases y 18 MB.
- **Cómo se llaman:** cada fichero lleva el hash de su texto, así que la app no necesita ninguna lista. Calcula el nombre, descarga el audio al usarlo y el service worker lo guarda.
- **Si falta un audio** (sin red, frase nueva o fallo del servicio), esa frase la lee la voz del móvil.
- **El inglés** lo lee siempre la voz del móvil.

El Editor sigue publicando con solo subir un KML (ADR 0004): el mismo despliegue genera los audios de las frases nuevas. Los demás vienen de la caché de GitHub Actions.

## Considered Options

Se escucharon muestras del mismo texto con cada opción, y se eligió Elvira.

- **Microsoft Ximena y Álvaro** (edge-tts): igual de buenas; fue cuestión de gusto.
- **Azure Speech, plan gratuito:**
  - A favor: las mismas voces, por la vía oficial. Da 500.000 caracteres al mes y usamos unos 37.000.
  - En contra: necesita una cuenta de Azure y una clave en los secrets del repo.
  - Es el plan B si edge-tts deja de funcionar.
- **Piper y Kokoro**, modelos abiertos que pueden generarse en el CI:
  - A favor: no dependen de nadie.
  - En contra: suenan claramente más sintéticos que Elvira.
- **Generar la voz en el navegador** (Piper o Kokoro con WebAssembly):
  - En contra: cada móvil descargaría un modelo de 28 a 90 MB.
  - En contra: en el iPhone tardaría segundos por frase y gastaría batería.
  - En contra: no aporta nada, porque el despliegue ya conoce todos los textos.

## Consequences

- **Dependemos de un servicio no oficial.** edge-tts usa el servicio de *Leer en voz alta* de Edge sin un acuerdo con Microsoft.
  - Si falla, el despliegue avisa y sigue adelante, y las frases sin audio se leen con la voz del móvil.
  - Los audios ya generados siguen valiendo.
  - Cambiar de motor es cambiar `scripts/voice.py` y la voz de `src/lib/clips.ts`.
- **Los textos salen del repo al generar la voz.** El despliegue envía a Microsoft los títulos y las Descripciones, que ya son públicos. Desde el móvil no sale nada nuevo: los audios se descargan de la propia web.
- **Sin red, solo suena con Elvira lo ya escuchado.** Los audios no se precargan, para no descargar 18 MB al instalar la app. Lo demás lo lee la voz del móvil.
- **Pausar ya no repite la frase:** con un audio, *Seguir* continúa donde se quedó.
- **El texto tiene que salir igual en el navegador y en el script.** Si el navegador saca un texto distinto (por ejemplo, de una Descripción con HTML), el nombre no coincide y esa frase la lee la voz del móvil.
